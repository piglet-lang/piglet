(module node/dev-server
  (:import
    piglet:dom
    [term :from cli/terminal]
    [str :from string]
    [http :from node/http-server]
    [fs :from "node:fs"]
    [fsp :from "node:fs/promises"]
    [jsdom :from "jsdom"]
    [mime-db :from "mime-db"]
    [path :from "node:path"]
    [process :from "node:process"]
    [url :from "node:url"]))

;; Dev HTTP server for Piglet web projects.
;;
;; Launch within the directory of your application. There should be a
;; `package.pig` there, and a `public/index.html` (currently hard-coded).
;;
;; Make sure there's an `importmap` for `astring`. Then you can import Piglet with
;;
;; <script type="module" src="/piglet/lib/piglet/browser/main.mjs?verbosity=0"></script>
;;
;; Your app's package.pig will be served at `/self/package.pig`, so you can do this:
;;
;; <script type="piglet">
;; (load-package "/self")
;; (require 'https://my-full-package-name:main)
;; (require 'https://piglet-lang.org/packages/piglet:pdp-client)
;; </script>
;;
;; References to other piglet packages in package.pig should use relative paths
;; (as you would do on Node.js). The dev-server will rewrite these to a URL path
;; prefix, so that the browser is able to load files within these packages.
;;
;; Next steps: allow configuring port, web roots, etc from CLI args. Generate
;; index.html dynamically if it's absent.

(def piglet-lang-path
  (path:resolve
    (url:fileURLToPath
      (.-location (find-package 'piglet)))
    "../.."))

(def roots
  "File system locations that are searched for assets/resources"
  [(path:resolve (process:cwd) "./public")
   (path:resolve (process:cwd) "./")])

(def package-locations
  "short package identifier -> filesystem location of the root of the package (directory pathname)"
  (box {"piglet" piglet-lang-path}))

(def packages
  "URL path -> package.pig (munged)"
  (box {}))

(def main-module (box nil))

(def import-map
  (box
    {"astring"
     (path:resolve piglet-lang-path "./node_modules/astring/dist/astring.mjs")}))

(def ext->mime
  (into {"pig" ["application/piglet" true "UTF-8"]}
    (for [[mime opts] (->pig mime-db:default)
          :when (:extensions opts)
          ext (:extensions opts)
          :let [comp (:compressible opts)
                charset (:charset opts)]]
      [ext [(name mime) comp charset]])))

(defn find-resource [path]
  (let [resource (some (fn [root]
                         (let [resource (path:resolve root (str "." path))]
                           (when (fs:existsSync resource)
                             resource)))
                   roots)]
    (if (and resource (.isDirectory (fs:lstatSync resource)))
      (let [index (str resource "/index.html")]
        (when (fs:existsSync index)
          index))
      resource)))

(defn media-type [filename]
  (let [[type _ charset] (or (get ext->mime (last (str:split "." filename)))
                           [])]

    (cond
      charset
      (str type ";charset=" charset)
      type
      type
      :else
      "application/octet-stream")))

(defn ^:async file-response [etag file]
  (-> (fsp:stat file)
    (.then
      (fn [stat]
        (if (and etag (= (str (hash (:mtime stat))) etag))
          {:status 304
           :headers {}
           :body ""}
          (.then (fsp:readFile file)
            (fn [data]
              {:status 200
               :headers {"Content-Type" (media-type file)
                         "ETag" (hash (:mtime stat))}
               :body data})))))
    (.then
      identity
      (fn [err]
        {:status 500
         :body (str "Error loading file: " err)}))))

(def four-oh-four
  {:status 404
   :body ""})

(defn redirect [dest]
  {:status 302
   :headers {"Location" dest}})

(defn npm-response [etag path]
  (if-let [file (get @import-map path)]
    ;; (println "GET" (str "/npm/" path) '-> (get @import-map path)))
    (redirect (str:replace file #".*/node_modules/" "/npm/"))
    ;; Handle wildcards
    (if-let [loc (some (fn [[pkg loc]]
                         (when (and (= "/" (last pkg))
                                 (.startsWith path pkg))
                           (path:resolve (str loc "/")
                             (.replace path pkg ""))))
                   @import-map)]
      (file-response etag loc)
      (or
        (reduce (fn [acc [loc _]]
                  (let [path (path:resolve (str (get @package-locations loc) "/node_modules/") path)]
                    (when (fs:existsSync path)
                      (reduced (file-response etag path)))))
          nil
          @packages)
        four-oh-four))))

(defn ^:async slurp-package-pig [pkg-pig-loc]
  (-> pkg-pig-loc
    slurp
    await
    read-string
    expand-qnames))

(declare register-package)

(defn munge-and-store-pkg-pig [pkg-pig pkg-loc short-id]
  (if-let [pp (get @packages pkg-loc)]
    pp
    (let [pp
          (-> pkg-pig
            (update :pkg:name
              (fn [name]
                (if name
                  name
                  (qsym (str (url:pathToFileURL pkg-loc))))))
            (update :pkg:deps
              (fn [deps]
                (into {}
                  (map (fn [[alias spec]]
                         [alias (update spec :pkg:location
                                  (fn [loc]
                                    (let [new-pkg-path (str (gensym (path:basename loc)))]
                                      (register-package (path:resolve pkg-loc loc) new-pkg-path)
                                      (str "/" new-pkg-path))))])
                    deps)))))]
      (swap! packages assoc short-id pp)
      pp)))

(defn ^:async package-pig-response [url-path pkg-loc pkg-pig-loc]
  (let [pkg-pig (await (slurp-package-pig pkg-pig-loc))]
    {:status 200
     :headers {"Content-Type" "application/piglet?charset=UTF-8"}
     :body (print-str (munge-and-store-pkg-pig pkg-pig pkg-loc (str:replace url-path #"/package.pig" "")))}))

(defn pig->html [h]
  (str "<!DOCTYPE html>\n"
    (.-outerHTML
      (dom:dom
        (.-window.document (jsdom:JSDOM. ""))
        h))))

(defn index-html [req]
  [:html
   [:head
    [:meta {:charset "utf-8"}]
    [:meta {:content "width=device-width, initial-scale=1" :name "viewport"}]
    [:script {:type "importmap"}
     (js:JSON.stringify (->js {:imports (into {}
                                          (map (fn [k]
                                                 [k (str "/npm/" k)])
                                            (keys @import-map)))}))]
    [:script {:type "application/javascript"
              :src "https://unpkg.com/source-map@0.7.3/dist/source-map.js"}]
    [:script {:type "module" :src (str "/piglet/lib/piglet/browser/main.mjs?verbosity="
                                    (get-in req [:query-params "verbosity"] 0))}]
    [:script {:type "piglet"}
     (print-str
       (list 'let '[pkg (await (load-package "/self"))]
         (when-let [main @main-module]
           (list 'await (list 'require (list 'qsym (list 'str '(.-name pkg) ":" (str main))))))))
     (print-str
       '(await (require 'https://piglet-lang.org/packages/piglet:pdp-client)))
     (print-str '(piglet:pdp-client:connect! "ws://127.0.0.1:17017"))]]
   [:body [:div#app]]])

(defn handle-missing [req]
  (if (or
        (= "/" (:path req))
        (= "/index.html" (:path req)))
    {:status 200
     :body (pig->html (index-html req))}
    four-oh-four))

(defn handler [req]
  (if-let [file (and
                  #_(not= "/" (:path req))
                  (find-resource (:path req)))]
    (file-response (get-in req [:headers "if-none-match"]) file)
    (let [parts (rest (str:split "/" (:path req)))
          [pkg-path] parts
          ;; FIXME: [... & more] not yet working inside let
          more (rest parts)
          pkg-loc (get @package-locations pkg-path)]
      (if (= "npm" pkg-path)
        (npm-response (get-in req [:headers "if-none-match"]) (str:join "/" more))
        (let [file (and pkg-loc (str pkg-loc "/" (str:join "/" more)))]
          (if (and
                (not= "/" (:path req))
                (fs:existsSync file))
            (if (= ["package.pig"] more)
              (package-pig-response pkg-path pkg-loc file)
              (file-response (get-in req [:headers "if-none-match"]) file))
            (handle-missing req)))))))

(defn str/butlast [s]
  (.substring s 0 (dec (.-length s))))

;; TODO: scope imports to piglet package
(defn expand-exports [npm-pkg-name npm-pkg-loc exports]
  (cond
    (string? exports)
    (if (= "*" (last npm-pkg-name) (last exports))
      [[(str/butlast npm-pkg-name)
        (path:resolve (str npm-pkg-loc "/") (str/butlast exports))]]
      [[npm-pkg-name (path:resolve (str npm-pkg-loc "/") exports)]])

    (array? exports)
    (mapcat (fn [e] (expand-exports npm-pkg-name npm-pkg-loc e)) exports)

    (:development exports)
    (expand-exports npm-pkg-name npm-pkg-loc (:development exports))

    (:import exports)
    (expand-exports npm-pkg-name npm-pkg-loc (:import exports))

    (:browser exports)
    (expand-exports npm-pkg-name npm-pkg-loc (:browser exports))

    (:default exports)
    (expand-exports npm-pkg-name npm-pkg-loc (:default exports))

    :else
    (apply concat
      (for [[k v] exports]
        (cond
          (= "." k)
          (expand-exports npm-pkg-name npm-pkg-loc v)
          (.startsWith k "./")
          (expand-exports (str npm-pkg-name (.substring k 1)) npm-pkg-loc v)
          :else
          (expand-exports k npm-pkg-loc v))))))

(defn ^:async register-package
  "Make the dev server aware of a piglet package, by "
  ([loc]
    (register-package loc loc))
  ([loc id]
    (swap! package-locations assoc id loc)
    (let [pkg-pig (await (slurp-package-pig (str loc "/package.pig")))
          munged (munge-and-store-pkg-pig pkg-pig loc id)
          node-mod-path (str loc "/node_modules")]
    (when (fs:existsSync node-mod-path)
      (doseq [dir (fs:readdirSync node-mod-path)]
        (when (not (= "." (first dir)))
          (let [npm-pkg-loc   (str node-mod-path "/" dir)
                pkg-json-path (str npm-pkg-loc "/package.json")]
            (when (fs:existsSync pkg-json-path)
              (let [package_json (js:JSON.parse (fs:readFileSync pkg-json-path))]
                (swap! import-map into
                  (reverse (expand-exports dir npm-pkg-loc
                             (or
                               (:exports package_json)
                               (get package_json "dev:module")
                               (:module package_json)
                               (:main package_json)
                               "index.js")))))))))))))

(defn wrap-log-req [handler]
  (fn ^:async [{:keys [method path] :as req}]
    (let [{:keys [status] :as res} (await (handler req))]
      (println
        (term:fg (cond
                   (= :get method) :cyan
                   (= :post method) :green
                   (= :put method) :blue
                   (= :delete method) :red
                   :else :yellow)
          (str:upcase (name method)))
        (term:fg :yellow path)
        (str "[" (term:fg :green status) "]"))
      res)))

(defn ^:async main [{:keys [port host]
                     :or {host "0.0.0.0"}}]
  (let [pkg-pig-loc (str (process:cwd) "/package.pig")]
    (when (not (fs:existsSync pkg-pig-loc))
      (println "WARN: package.pig not found, creating stub")
      (spit "package.pig" ";; stub package.pig created by dev-server\n{:pkg:paths [\"src\"]\n :pkg:main main}"))
    (let [pkg-pig (await (slurp-package-pig pkg-pig-loc))]
      (when-let [main (:pkg:main pkg-pig)]
        (reset! main-module main))))
  (await (register-package (process:cwd) "self"))
  (let [server (http:create-server
                 (wrap-log-req handler)
                 {:port port
                  :host host})]

    (println
      (term:fg :cyan "Starting http server on")
      (term:fg :green (str "http://" host ":" port)))
    (http:start! server)))
