"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Tạo bảng wallets
    await queryInterface.createTable("wallets", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
      },
      balance: {
        type: Sequelize.DECIMAL(16, 4),
        allowNull: false,
        defaultValue: "0.0000",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Index cho member_id trên wallets
    await queryInterface.addIndex("wallets", ["member_id"]);

    // 2. Tạo bảng deposits
    await queryInterface.createTable("deposits", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      member_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      psp_ref: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true, // Unique index cực kỳ quan trọng để chống duplicate callback!
      },
      amount: {
        type: Sequelize.DECIMAL(16, 4),
        allowNull: false,
      },
      turnover_multiplier: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      required_turnover: {
        type: Sequelize.DECIMAL(16, 4),
        allowNull: false,
        defaultValue: "0.0000",
      },
      status: {
        type: Sequelize.ENUM("Pending", "Completed", "Failed"),
        allowNull: false,
        defaultValue: "Pending",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Index cho deposits
    await queryInterface.addIndex("deposits", ["psp_ref"]);
    await queryInterface.addIndex("deposits", ["member_id", "status"]);

    // 3. Tạo bảng withdrawals
    await queryInterface.createTable("withdrawals", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      member_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(16, 4),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("Pending", "Approved", "Rejected"),
        allowNull: false,
        defaultValue: "Pending",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("withdrawals", ["member_id"]);

    // 4. Tạo bảng wallet_txs (Append-only Ledger)
    await queryInterface.createTable("wallet_txs", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      wallet_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "wallets",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      member_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM("DEPOSIT", "WAGER", "WITHDRAWAL"),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(16, 4), // Luôn lưu số dương
        allowNull: false,
      },
      balance_before: {
        type: Sequelize.DECIMAL(16, 4),
        allowNull: false,
      },
      balance_after: {
        type: Sequelize.DECIMAL(16, 4),
        allowNull: false,
      },
      reference_id: {
        type: Sequelize.STRING, // ID của deposit/wager/withdrawal tương ứng
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Index cho ledger query
    await queryInterface.addIndex("wallet_txs", ["wallet_id"]);
    await queryInterface.addIndex("wallet_txs", ["member_id", "type"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("wallet_txs");
    await queryInterface.dropTable("withdrawals");
    await queryInterface.dropTable("deposits");
    await queryInterface.dropTable("wallets");
  },
};
