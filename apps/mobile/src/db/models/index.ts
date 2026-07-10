import Document from './Document';
import BillReceipt from './BillReceipt';
import TrackedItem from './TrackedItem';
import Transaction from './Transaction';
import Budget from './Budget';
import Group from './Group';
import GroupMember from './GroupMember';
import Expense from './Expense';
import ExpenseShare from './ExpenseShare';
import Settlement from './Settlement';
import OcrUsage from './OcrUsage';
import WarrantyLookupRow from './WarrantyLookupRow';

export {
  Document,
  BillReceipt,
  TrackedItem,
  Transaction,
  Budget,
  Group,
  GroupMember,
  Expense,
  ExpenseShare,
  Settlement,
  OcrUsage,
  WarrantyLookupRow,
};

/** All model classes, registered with the WatermelonDB Database. */
export const modelClasses = [
  Document,
  BillReceipt,
  TrackedItem,
  Transaction,
  Budget,
  Group,
  GroupMember,
  Expense,
  ExpenseShare,
  Settlement,
  OcrUsage,
  WarrantyLookupRow,
];
