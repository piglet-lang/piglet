;;; piglet-mode.el --- User interface configuration for Corgi -*- lexical-binding: t -*-

;; Author: Arne Brasseur <arne@arnebrasseur.net>
;; Filename: piglet-mode.el
;; Package-Requires: ((treesit) (rainbow-delimiters))
;; Keywords: piglet languages tree-sitter

;;; Commentary:

;; Major mode and interactive development commands for Piglet. Based on
;; Tree-sitter, so you will need Emacs 29. Work in progress.

;;; Code:

(require 'treesit)
(require 'rainbow-delimiters)

;;(setq treesit-language-source-alist nil)
(add-to-list
 'treesit-language-source-alist
 '(piglet ;;"https://github.com/piglet-lang/tree-sitter-piglet.git"
   "/home/arne/github/tree-sitter-piglet"
   ))

;; (treesit-install-language-grammar 'piglet)
(defvar piglet-mode-indent-offset
  2)

(defvar piglet-ts--indent-rules
  '((piglet
     ((parent-is "list") first-sibling 2)
     ((parent-is "vector") first-sibling 1)
     )))

(defvar piglet-mode--font-lock-settings
  (treesit-font-lock-rules
   :feature 'parens
   :language 'piglet
   '((["(" ")" "[" "]" "{" "}"]) @rainbow-delimiters-depth-2-face)
   ))

(define-derived-mode piglet-mode prog-mode "Piglet"
  "Major mode for editing Piglet files."
  (unless (treesit-ready-p 'piglet)
    (if (yes-or-no-p "Tree-sitter grammar for Piglet not found. Install it now? ")
        (treesit-install-language-grammar 'piglet)
      (error "Tree-sitter for Piglet isn't available")))

  (rainbow-delimiters-mode)

  (treesit-parser-create 'piglet)

  ;; Comments
  (setq-local comment-start ";; ")
  (setq-local comment-start-skip ";+ *")
  (setq-local comment-end "")

  ;; Electric
  (setq-local electric-indent-chars
              (append "[]{}()" electric-indent-chars))

  ;; Indent
  (setq-local treesit-simple-indent-rules piglet-ts--indent-rules)

  ;; Navigation
  ;; (setq-local treesit-defun-type-regexp ...)
  ;; (setq-local treesit-defun-name-function #'piglet-mode--defun-name)

  ;; Font-lock.
  (setq-local treesit-font-lock-settings piglet-mode--font-lock-settings)
  (setq-local treesit-font-lock-feature-list '((parens)))

  ;; Imenu.
  ;; (setq-local treesit-simple-imenu-settings '())

  (treesit-major-mode-setup))


(provide 'piglet-mode)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;; piglet-mode.el ends here
