(module node/dev-server
  (:import
    [http :from node/http-server]
    [path :from "node:path"]
    [fs :from "node:fs"]
    [url :from "node:url"]
    [process :from "node:process"]
    [mime-db :from "mime-db"]))

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
;; References to other piglet packages in pacakge.pig should use relative paths
;; (as you would do on Node.js). The dev-server will rewrite these to a URL path
;; prefix, so that the browser is able to load files within these packages.
;;

;; This is a bare-bones starting point with everything hard coded. We don't have
;; a good mechanism for argument handling yet, so we'll need that and some way
;; to call a "main" function from the CLI.
;;
;; Next steps: allow configuring port, web roots, etc from CLI args. Generate
;; index.html dynamically if it's absent.

(def piglet-lang-path
  (path:resolve
    (url:fileURLToPath
      (.-location (find-package 'piglet)))
    "../.."))

(def roots [(path:resolve (process:cwd) "./public")])

(def package-locations
  (reference
    {"self" (process:cwd)
     "piglet" piglet-lang-path}))

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
  (let [[type _ charset] (or (get ext->mime (last (split "." filename)))
                           [])]

    (cond
      charset
      (str type ";charset=" charset)
      type
      type
      :else
      "application/octet-stream")))

(defn file-response [file]
  {:status 200
   :headers {"Content-Type" (media-type file)}
   :body (fs:readFileSync file)})

(def four-oh-four
  {:status 404
   :body ""})

(defn ^:async package-pig-response [url-path pkg-loc pkg-pig-loc]
  (let [pkg-pig (-> pkg-pig-loc
                  slurp
                  await
                  read-string
                  expand-qnames)]
    {:status 200
     :headers {"Content-Type" "application/piglet?charset=UTF-8"}
     :body
     (print-str
       (update pkg-pig :pkg:deps
         (fn [deps]
           (into {}
             (map (fn [[alias spec]]
                    [alias (update spec :pkg:location
                             (fn [loc]
                               (let [new-pkg-path (str (gensym "pkg"))]
                                 (swap! package-locations assoc new-pkg-path
                                   (path:resolve pkg-loc loc))
                                 (str "/" new-pkg-path))))])
               deps)))))}))

(defn handler [req]
  (if-let [file (find-resource (:path req))]
    (file-response file)
    (let [parts (split "/" (:path req))
          [_ pkg-path] parts
          ;; FIXME: [... & more] not yet working inside let
          more (rest (rest parts))
          pkg-loc (get @package-locations pkg-path)]
      (let [file (and pkg-loc (str pkg-loc "/" (join "/" more)))]
        (if (fs:existsSync file)
          (if (= ["package.pig"] more)
            (package-pig-response pkg-path pkg-loc file)
            (file-response file))
          four-oh-four)))))

(def server (http:create-server
              (fn [req] (handler req))
              {:port 1234}))

(println "Starting http server")
(http:start! server)

#_ (http:stop! server)
