(module oauth-client
  "Example of performing OAuth2 code exchange"
  (:import
    [cp :from "node:child_process"]))

(def oauth-config
  {;; Get these from the service's API docs
   :authorization-url "https://app.put.io/oauth/authenticate"
   :token-url "https://api.put.io/v2/oauth2/access_token"
   ;; You should have received these when creating a new oauth "app"
   :client-id ""
   :client-secret ""
   ;; This is your own service, you will need to run a webserver here,
   ;; and register this in the oauth app config. For testing this code,
   ;; you don't _have_ to create a web server, you can let the redirect
   ;; fail, and manually copy the `code` param from your browser's
   ;; address bar.
   :redirect-url "http://localhost:5678/oauth/v2/callback"})

(defn query-params [kvs]
  (str "?" (js:URLSearchParams. kvs)))

(defn browse-url!
  "Unix-style helper, switch to npm 'open' package for something more robust"
  [url]
  (cp:exec (str "xdg-open " (print-str url))))

(defn start-auth!
  "Open a browser to start the auth flow"
  [{:keys [client-id authorization-url redirect-url]}]
  (browse-url!
    (str authorization-url
      (query-params {"client_id" client-id
                     "redirect_uri" redirect-url
                     "response_type" "code"}))))

(start-auth! oauth-config)

;; the `code=...` query-param once the oauth flow gets redirected back to your callback URL
(def code "")

(defn ^:async exchange-code!
  "Final step, exchange the code for an access_token / refresh_token"
  [{:keys [token-url redirect-url client-id client-secret]} code]
  (.json
    (await
      (js:fetch
        (str token-url
          (query-params
            {"grant_type" "authorization_code"
             "code" code
             "redirect_uri" redirect-url
             "client_id" client-id
             "client_secret" client-secret}))))))

(def res (await (exchange-code! oauth-config code)))

(:access_token res)
