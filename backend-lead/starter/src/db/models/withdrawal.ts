import { DataTypes, Model, Sequelize } from "sequelize";

export class Withdrawal extends Model {
  declare id: string;
  declare memberId: string;
  declare amount: string;
  declare status: "Pending" | "Completed" | "Failed";
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initWithdrawal(sequelize: Sequelize): void {
  Withdrawal.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      memberId: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      status: {
        type: DataTypes.ENUM("Pending", "Completed", "Failed"),
        allowNull: false,
        defaultValue: "Pending",
      },
    },
    { sequelize, tableName: "withdrawals", underscored: true },
  );
}
