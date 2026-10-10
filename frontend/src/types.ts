export type User = { id: string; phone: string; fullName: string; email?: string; roles: string[] };
export type AuthResult = { user: User; tokens: { accessToken: string; refreshToken: string } };
export type Point = { address: string; lat: number; lng: number };
export type RouteGeometry = { type: "LineString"; coordinates: number[][] };
export type RideStop = Point & {
  id?: string;
  orderIndex?: number;
  dwellMinutes?: number;
  fee?: string | number;
};
export type VehicleType = { id: string; code: string; name: string; capacity: number };
export type Ride = {
  id: string;
  status: string;
  pickupAddress: string;
  pickupLat: string | number;
  pickupLng: string | number;
  dropoffAddress: string;
  dropoffLat: string | number;
  dropoffLng: string | number;
  estimatedFare: string;
  finalFare: string | null;
  estimatedDistanceKm: string;
  estimatedDurationMin: number;
  actualDistanceKm?: string | null;
  actualDurationMin?: number | null;
  waitingMinutes?: number;
  waitingFee?: string | number;
  cancellationFee?: string | number;
  discountAmount?: string | number;
  fareBreakdown?: Record<string, unknown> | null;
  startPin?: string;
  requestedAt: string;
  paymentMethod: string;
  customer: User;
  vehicleType: VehicleType;
  scheduledAt?: string | null;
  matchingStartedAt?: string | null;
  stopFee?: string | number;
  surchargeAmount?: string | number;
  surchargeBreakdown?: { ruleId: string; name: string; type: string; amount: number }[];
  routeGeometry?: RouteGeometry | null;
  routeProvider?: string | null;
  stops?: RideStop[];
  offerExpiresAt?: string;
  pickupDistanceKm?: number;
  matchingRadiusKm?: number;
  driver?: Driver | null;
  rating?: { score: number; comment?: string } | null;
  payment?: Payment | null;
  invoice?: Invoice | null;
  statusLogs?: { id: string; toStatus: string; createdAt: string }[];
};
export type Invoice = {
  id: string;
  invoiceNumber: string;
  subtotal: string;
  waitingFee: string;
  stopFee: string;
  surchargeAmount: string;
  discountAmount: string;
  total: string;
  currency: string;
  issuedAt: string;
};
export type VietQr = {
  provider: string;
  reference: string;
  amount: number;
  bankBin: string;
  accountNumber: string;
  accountName: string;
  qrUrl: string;
  expiresAt: string;
};
export type Payment = {
  id: string;
  status: string;
  amount: string;
  method: string;
  paymentReference?: string | null;
  expiresAt?: string | null;
  vietQr?: VietQr | null;
};
export type Driver = {
  id: string;
  userId: string;
  user: User;
  verificationStatus: string;
  onlineStatus: string;
  ratingAvg: string;
  totalRides: number;
  vehicles: { id: string; plateNumber: string; model?: string; color?: string; vehicleType: VehicleType }[];
  location?: { lat: string | number; lng: string | number; updatedAt: string } | null;
  wallet?: { balance: string } | null;
};
export type Estimate = {
  vehicleType: VehicleType;
  distanceKm: number;
  durationMin: number;
  estimatedFare: number;
  discount: number;
  finalFare: number;
  stopFee: number;
  fareBeforeSurcharge: number;
  surchargeAmount: number;
  surchargeBreakdown: { ruleId: string; name: string; type: string; amount: number }[];
  weatherCondition: string;
  routeGeometry: RouteGeometry;
  routeProvider: string;
  trafficAware: boolean;
  legs: { distanceKm: number; durationMin: number }[];
};
export type CustomerWallet = {
  id: string;
  balance: number;
  currency: string;
  transactions: WalletEntry[];
  pendingTopUps: { id: string; amount: string; paymentReference: string; expiresAt: string }[];
};
export type WalletEntry = {
  id: string;
  amount: string;
  type: string;
  description?: string | null;
  createdAt: string;
};
export type DriverWallet = {
  id: string;
  balance: number;
  pendingBalance: number;
  availableBalance: number;
  currency: string;
  completedRides: number;
  commissionRate: number;
  summary: Record<string, number>;
  transactions: WalletEntry[];
  withdrawals: Withdrawal[];
};
export type Withdrawal = {
  id: string;
  amount: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  status: string;
  rejectionReason?: string | null;
  createdAt: string;
  driver?: Driver;
};
export type Page<T> = { items: T[]; total: number; page: number; limit: number };
export type Pricing = {
  id: string;
  vehicleTypeId: string;
  vehicleType: VehicleType;
  baseFare: string;
  perKmFare: string;
  perMinuteFare: string;
  minimumFare: string;
  peakMultiplier: string;
  isActive: boolean;
};
export type Promotion = {
  id: string;
  code: string;
  name: string;
  type: string;
  value: string;
  usageLimit?: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  maxDiscount?: string;
  minRideFare?: string;
};
export const money = (value: string | number | null | undefined) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(value ?? 0));
export const date = (value: string) => new Date(value).toLocaleString("vi-VN");
export const labels: Record<string, string> = {
  SCHEDULED: "Đã lên lịch",
  SEARCHING_DRIVER: "Đang tìm tài xế",
  ACCEPTED: "Tài xế đã nhận",
  DRIVER_ARRIVING: "Tài xế đang đến",
  ARRIVED: "Đã đến điểm đón",
  IN_PROGRESS: "Đang di chuyển",
  COMPLETED: "Hoàn thành",
  CANCELLED_BY_CUSTOMER: "Khách đã hủy",
  CANCELLED_BY_DRIVER: "Tài xế đã hủy",
  CANCELLED_BY_SYSTEM: "Quản trị đã hủy",
  NO_DRIVER_FOUND: "Không tìm thấy tài xế",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  ONLINE: "Online",
  OFFLINE: "Offline",
  BUSY: "Đang có chuyến",
  PAID: "Đã thanh toán",
  FAILED: "Thất bại",
  REFUNDED: "Đã hoàn tiền",
  ACTIVE: "Hoạt động",
  LOCKED: "Đã khóa",
  TOP_UP: "Nạp tiền",
  RIDE_PAYMENT: "Thanh toán chuyến",
  RIDE_EARNING: "Doanh thu chuyến",
  COMMISSION: "Hoa hồng nền tảng",
  CASH_COLLECTION: "Tiền mặt đã thu",
  WITHDRAWAL: "Rút tiền"
};
export const terminal = (status: string) =>
  status === "COMPLETED" || status.startsWith("CANCELLED") || status === "NO_DRIVER_FOUND";
