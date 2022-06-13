#!/bin/bash

if [ -f ../build/dev/Catenis_dev-$npm_package_version.tar.gz ]; then
    echo "Catenis (dev) app already built for the current version ($npm_package_version)"
    exit 1
fi

arch -arm64 meteor build ../build/dev/ && echo -n "Adding config dir to server tarball..." && mkdir ../build/dev/__temp && mkdir ../build/dev/__temp/bundle && ln -s -F ../../../../meteor_app/config ../build/dev/__temp/bundle/config && tar -cHzf ../build/dev/Catenis_dev-$npm_package_version.tar.gz --exclude .DS_Store @../build/dev/meteor_app.tar.gz -C../build/dev/__temp bundle/config && echo " Done" && rm -r ../build/dev/__temp ../build/dev/meteor_app.tar.gz