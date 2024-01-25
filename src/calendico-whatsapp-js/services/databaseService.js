const { Pool } = require('pg');

const dbConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
};

class PostgreSQLStore {
    constructor(sessionName) {
        this.sessionName = sessionName;
        console.log("------------------");
        console.log('Creating PostgreSQLStore');
        console.log('dbConfig:', dbConfig);
        console.log("------------------");
        this.pool = new Pool(dbConfig);
    }

    async initializeDatabase() {
        //const client = await this.pool.connect();
        try {
            await this.pool.query(`CREATE TABLE IF NOT EXISTS sessions (
                                    session_name TEXT PRIMARY KEY,
                                    session_data TEXT NOT NULL
                                )`);
        } catch (err) {
            console.error('Error creating sessions table:', err.message);
            throw err;
        } finally {
            //client.release();
        }
    }

    async save(data) {
        //const client = await this.pool.connect();
        try {
            await this.pool.query(`INSERT INTO sessions (session_name, session_data)
                                VALUES ($1, $2)
                                ON CONFLICT (session_name) 
                                DO UPDATE SET session_data = EXCLUDED.session_data`,
                [this.sessionName, JSON.stringify(data)]);
        } catch (err) {
            throw err;
        } finally {
            //client.release();
        }
    }

    async delete() {
        //const client = await this.pool.connect();
        try {
            await this.pool.query('DELETE FROM sessions WHERE session_name = $1', [this.sessionName]);
        } catch (err) {
            throw err;
        } finally {
            //client.release();
        }
    }

    async sessionExists() {
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT 1 FROM sessions WHERE session_name = $1', [this.sessionName]);
            return result.rowCount > 0;
        } catch (err) {
            throw err;
        } finally {
            client.release();
        }
    }

    async extract() {
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT session_data FROM sessions WHERE session_name = $1', [this.sessionName]);
            return result.rows.length > 0 ? JSON.parse(result.rows[0].session_data) : null;
        } catch (err) {
            throw err;
        } finally {
            client.release();
        }
    }
}

module.exports = PostgreSQLStore;
