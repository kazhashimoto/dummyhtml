# dummyhtml

## Installation
```
$ mkdir test-package
$ cd test-package
$ npm init -y
$ echo "@kazhashimoto:registry=https://npm.pkg.github.com" > .npmrc
$ npm install -g @kazhashimoto/dummyhtml@1.x.x
```

How to uninstall this package:
```
$ npm uninstall -g @kazhashimoto/dummyhtml
```

## Usage
```
$ dummyhtml --help
Usage: dummyhtml [options] htmlpath

Options:
  -V, --version  output the version number
  -a, --all      output all element nodes
  -d, --dummy    insert dummy text and links
  --no-head      remove html head from output
  --head <path>  include html head from template file
  --placeholder  embed placeholder images
  --rehash       rehash Lorem Ipsum table
  --fill         insert dummy text to elements with no content
  -h, --help     display help for command
```

## Turning on debug mode
```
$ DEBUG=* dummyhtml [options] htmlpath
```
