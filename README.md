# IUBH Campus Sync
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)


## 🧐 What's this?

This script logs into [IUBH's MyCampus](mycampus.iubh.de/) using [Puppeteer](https://pptr.dev/) and then downloads the
files provided there. I use this script so that I don't have to download the files manually. The script was built to be
triggered periodically e.g. by cronjob, therefore for example already existing files or renamed files are recognized to
some extent.


## ☁ Installation

To install the javascript module via npm run:

	npm install -g @sebbo2002/iubh-campus-sync

You can also use the provided Docker container:

    docker pull sebbo2002/iubh-campus-sync


## 🔧 Configuration
| Environment Variable | Description                                    |
|:-------------------- |:---------------------------------------------- |
| `SYNC_PATH`          | Absolute folder path to sync all the files to. |
| `SYNC_USERNAME`      | MyCampus Username                              |
| `SYNC_PASSWORD`      | MyCampus Password                              |


## 👩‍⚖️ Copyright & License
Copyright (c) Sebastian Pekarek under the [MIT license](LICENSE).
