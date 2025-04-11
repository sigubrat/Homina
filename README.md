# homina

**_Homina-homina-homina_**

Blessed is the Machine Spirit.

This is a simple Discord bot intended to provide guilds with useful information regarding its members, guild, and guild raid information. It will be updated as Snowprint updates their public API.

---

## Stack

-   Discord integration handled by [discord.js](https://discord.js.org/docs/packages/discord.js/14.18.0)
-   Built using [Bun](https://bun.sh/)
-   Data Visualization through [D3](https://d3js.org/)

---

## Prerequisites

Before running the project, ensure you have the following installed:

-   [Node.js](https://nodejs.org/) or [Bun](https://bun.sh/) (latest version recommended)
-   [PostgreSQL](https://www.postgresql.org/) for database management
-   A Discord bot token (create one via the [Discord Developer Portal](https://discord.com/developers/applications))

## Database Configuration

1. Ensure PostgreSQL is installed and running.
2. Create a database for the bot:
    ```bash
    createdb homina
    ```
3. Update the `.env` file with your database credentials (`DB_NAME`, `DB_USER`, `DB_PWD`).
4. Run the following command to create the necessary tables:
    ```bash
    bun run createTables
    ```

---

## Environment Variables

Create a `.env` file in the root of the project and add the following variables:

```plaintext
BOT_TOKEN=your-bot-token
CLIENT_ID=your-client-id
GUILD_ID=your-guild-id
DB_NAME=your-database-name
DB_USER=your-database-user
DB_PWD=your-database-password
```

## Before running the bot

To install dependencies:

```bash
bun install
```

To create database tables:

```bash
bun run createTables
```

To deploy commands so that they're available in Discord:

```bash
bun run deployCommands
```

## Usage

To run the bot:

```bash
bun run bot
```

The bot checks the database connection before starting up, but if you want to test it without waiting for the bot you can use:

```
bun run testDb
```

---

## Features

TBD

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository.
2. Create a new branch for your feature or bugfix:
    ```bash
    git checkout -b feature-name
    ```
3. Commit your changes:
    ```bash
    git commit -m "Add feature-name"
    ```
4. Push to your branch:
    ```bash
    git push origin feature-name
    ```
5. Open a pull request.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## Common Issues

### Database Connection Errors

-   Ensure PostgreSQL is running and the credentials in the `.env` file are correct.
-   Verify that the database exists by running:
    ```bash
    psql -l
    ```

### Missing Environment Variables

-   Double-check that all required variables are present in the `.env` file.

---

## Screenshots

Here’s an example of the bot in action:

![Bot Example](https://via.placeholder.com/800x400?text=Screenshot+Placeholder)

---

## Acknowledgments

-   Thanks to [Snowprint Studios](https://snowprintstudios.com/) for their public API.
-   Inspired by the community of Discord bot developers.
