require('dotenv').config();

const url =
  process.env.NODE_ENV === 'test'
    ? process.env.DATABASE_URL_TEST ||
      'postgres://postgres:123456@localhost:5432/postgres'
    : process.env.DATABASE_URL ||
      'postgres://postgres:123456@localhost:5432/postgres';

module.exports = {
  development: { url, dialect: 'postgres' },
  test: { url, dialect: 'postgres' },
  production: { url, dialect: 'postgres' },
};
