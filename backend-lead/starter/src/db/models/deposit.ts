import { DataTypes, Model, Sequelize } from "sequelize";

export class Deposit extends Model {
  declare id: string;
  declare memberId: string;
  declare pspRef: string;
  declare amount: string;
  declare turnoverMultiplier: number;
  declare requiredTurnover: string;
  declare status: "Pending" | "Completed" | "Failed";
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initDeposit(sequelize: Sequelize): void {
  Deposit.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      memberId: { type: DataTypes.UUID, allowNull: false },
      pspRef: { type: DataTypes.STRING, allowNull: false, unique: true },
      amount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      turnoverMultiplier: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      requiredTurnover: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false,
        defaultValue: "0",
      },
      status: {
        type: DataTypes.ENUM("Pending", "Completed", "Failed"),
        allowNull: false,
        defaultValue: "Pending",
      },
    },
    { sequelize, tableName: "deposits", underscored: true },
  );
}
