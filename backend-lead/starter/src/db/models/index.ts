import { sequelize } from '../sequelize';
import { Member, initMember } from './member';
import { Wallet, initWallet } from './wallet';
import { Deposit, initDeposit } from './deposit';
import { Withdrawal, initWithdrawal } from './withdrawal';
import { WalletTx, initWalletTx } from './walletTx';

// 1. Initialize all models first
initMember(sequelize);
initWallet(sequelize);
initDeposit(sequelize);
initWithdrawal(sequelize);
initWalletTx(sequelize);

// 2. Define associations
Member.hasOne(Wallet, { foreignKey: 'memberId', as: 'wallet' });
Wallet.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });

Member.hasMany(Deposit, { foreignKey: 'memberId', as: 'deposits' });
Deposit.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });

Member.hasMany(Withdrawal, { foreignKey: 'memberId', as: 'withdrawals' });
Withdrawal.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });

Wallet.hasMany(WalletTx, { foreignKey: 'walletId', as: 'transactions' });
WalletTx.belongsTo(Wallet, { foreignKey: 'walletId', as: 'wallet' });

Member.hasMany(WalletTx, { foreignKey: 'memberId', as: 'transactions' });
WalletTx.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });

// 3. Export everything for shared use
export { Member, Wallet, Deposit, Withdrawal, WalletTx };
