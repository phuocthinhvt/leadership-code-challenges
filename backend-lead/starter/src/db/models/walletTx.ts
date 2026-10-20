import { DataTypes, Model, Sequelize } from "sequelize";

export class WalletTx extends Model {
  declare id: string;
  declare walletId: string;
  declare memberId: string;
  declare type: string;
  declare amount: string;
  declare balanceBefore: string;
  declare balanceAfter: string;
  declare referenceId?: string;
  declare readonly createdAt: Date;
}

export function initWalletTx(sequelize: Sequelize): void {
  WalletTx.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      walletId: { type: DataTypes.UUID, allowNull: false },
      memberId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      amount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      balanceBefore: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      balanceAfter: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      referenceId: { type: DataTypes.STRING, allowNull: true },
    },
    { sequelize, tableName: "wallet_txs", underscored: true, updatedAt: false },
  );
}
