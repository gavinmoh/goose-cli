# Goose CLI

This is an unofficial npm wrapper for the [goose](https://github.com/pressly/goose) database migration tool. It allows you to use the goose CLI without needing to install Go or manually download the binary.

## Installation

You can install this package globally or as a dev dependency in your project.

### pnpm
```bash
pnpm add -D goose-cli
```

### npm
```bash
npm install --save-dev goose-cli
```

### yarn
```bash
yarn add -D goose-cli
```

## Usage
Once installed, you can use the `goose` command directly in your terminal or in your `package.json` scripts.

### CLI
```bash
goose --version
```

### package.json scripts
```json
{
  "scripts": {
    "db:migrate": "goose sqlite3 ./foo.db up"
  }
}
```

Then run the script:
```bash
pnpm db:migrate
```

For more information on how to use goose, please refer to the [official documentation](https://github.com/pressly/goose).

## How it works
This package downloads the appropriate goose binary for your operating system and architecture from the official [goose releases](https://github.com/pressly/goose/releases) and executes it with the arguments you provide.

## License
This project is licensed under the MIT License. See the `LICENSE` file for details.

The goose binary is distributed under the MIT License. See the [original license](https://github.com/pressly/goose/blob/main/LICENSE) for more information.
