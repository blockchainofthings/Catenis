#!/bin/bash

if [ -f ../build/Catenis-$npm_package_version.tar.gz ]; then
    echo "Catenis app already built for the current version ($npm_package_version)"
    exit 1
fi

arch -arm64 meteor build --architecture=os.linux.x86_64 ../build/ && echo -n "Adding childProcess and config directories to server tarball..." && mkdir ../build/__temp && mkdir ../build/__temp/bundle && ln -s -F ../../../meteor_app/childProcess ../build/__temp/bundle/childProcess && ln -s -F ../../../meteor_app/config ../build/__temp/bundle/config && tar -cHzf ../build/Catenis-$npm_package_version.tar.gz --exclude .DS_Store --exclude bundle/config/*development*.json5 --exclude bundle/config/*qa*.json5 --exclude bundle/config/*debug*.json5 @../build/meteor_app.tar.gz -C../build/__temp bundle/childProcess bundle/config && echo " Done" && rm -r ../build/__temp ../build/meteor_app.tar.gz