(let* ((root (make-pathname :name nil :type nil :defaults *load-truename*)))
  (dolist (file '("src/core.lisp" "src/database.lisp" "src/http.lisp" "src/main.lisp"))
    (load (merge-pathnames file root))))
(mend:main)
