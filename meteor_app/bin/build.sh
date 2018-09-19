#!/bin/bash

if [ -f ../build/Catenis-$npm_package_version.tar.gz ]; then
    echo "Catenis app already built for the current version ($npm_package_version)"
    exit -1
fi

meteor build --architecture=os.linux.x86_64 ../build/ && echo -n "Adding config dir to server tarball..." && mkdir ../build/__temp && mkdir ../build/__temp/bundle && ln -s -F ../../../meteor_app/config ../build/__temp/bundle/config && tar -cHzf ../build/Catenis-$npm_package_version.tar.gz --exclude .DS_Store --exclude bundle/config/*development*.json @../build/meteor_app.tar.gz -C../build/__temp bundle/config && echo " Done" && rm -r ../build/__temp ../build/meteor_app.tar.gz