release:
  #!/bin/sh
  VERSION="$(pnpm version patch --no-git-tag-version -m 'Release %s')"
  VERSION_NUMBER="$(echo -n $VERSION | sed s/v//)"
  cat <<EOF | ed CHANGELOG.md
  1s/Unreleased/$(echo $VERSION_NUMBER) ($(date +"%Y-%m-%d") \/ $(git rev-parse --short=6 HEAD))
  1i
  # Unreleased
  
  ## Added
  
  ## Fixed
  
  ## Changed
  
  .
  wq
  EOF
  
  git add package.json CHANGELOG.md
  git commit -m "Release ${VERSION}"
  git tag "${VERSION}"
  git push
  git push --tags
  pnpm publish