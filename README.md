# Catenis

Catenis is an integration layer to the Bitcoin blockchain that allows for rapid blockchain-based application
 development.

## Development environment

Catenis is developed using [Meteor](https://www.meteor.com), a [JavaScript/Node.js](https://nodejs.org/en/)
 framework for rapid web/mobile application development.

The IDE used for development is [WebStorm](https://www.jetbrains.com/webstorm/) from JetBrains.

The WebStorm project is set up in a way that the meteor application is contained in the `/meteor_app` directory.

### Increasing the development DB oplog size

Follow the steps bellow to increase the size of the oplog collection of Mongo DB database used in the meteor
 development environment.

1. Start the Catenis meteor application.

2. Issue the following command from the `/meteor_app` directory:

```shell
meteor mongo
```

3. Then, from the mongo shell, issue the following commands:

```shell
use local
db.adminCommand({replSetResizeOplog: 1, size: 990})
```

> **Note**: this only needs to be done once, after the application environment database is reset.

## Building the application

To build the application, execute the following command from the `/meteor_app` directory:

```shell
meteor npm run build
```

A tar ball containing the packaged meteor application is written to the `/build` directory.

Alternatively, the application can be built for the development environment. To do this, execute the following command
 also from the `/meteor_app` directory:

```shell
meteor npm run build_dev
```

In this case, the tar ball containing the packaged meteor application is written to the `/build/dev` environment.

## Deploying the application to the sandbox environment

After building the application, execute the following command from the `/build` directory:

```shell
scp ../build/Catenis-<ver>.tar.gz ctn-sandbox-1:~/Catenis_build/
```

> **Note**: replace `<ver>` with the proper version number.

## License

This project is for Blockchain of Things' internal use only.

Copyright © 2017-2021, Blockchain of Things Inc.