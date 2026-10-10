import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const roles = [
    ["CUSTOMER", "Khach hang"],
    ["DRIVER", "Tai xe"],
    ["ADMIN", "Quan tri vien"],
    ["OPERATOR", "Dieu phoi"],
    ["SUPPORT", "Cham soc khach hang"],
    ["ACCOUNTANT", "Ke toan"]
  ] as const;

  for (const [name, label] of roles) {
    await prisma.role.upsert({
      where: { name },
      update: { label },
      create: { name, label }
    });
  }

  const vehicleTypes = [
    {
      code: "BIKE",
      name: "Xe may",
      capacity: 1,
      baseFare: 12000,
      perKmFare: 4500,
      perMinuteFare: 800
    },
    {
      code: "CAR4",
      name: "O to 4 cho",
      capacity: 4,
      baseFare: 25000,
      perKmFare: 11000,
      perMinuteFare: 1500
    },
    {
      code: "CAR7",
      name: "O to 7 cho",
      capacity: 7,
      baseFare: 32000,
      perKmFare: 14000,
      perMinuteFare: 1800
    }
  ];

  for (const item of vehicleTypes) {
    const vehicleType = await prisma.vehicleType.upsert({
      where: { code: item.code },
      update: item,
      create: item
    });

    await prisma.pricingRule.upsert({
      where: { id: vehicleType.id },
      update: {
        vehicleTypeId: vehicleType.id,
        baseFare: item.baseFare,
        perKmFare: item.perKmFare,
        perMinuteFare: item.perMinuteFare,
        minimumFare: item.baseFare,
        peakMultiplier: 1
      },
      create: {
        id: vehicleType.id,
        vehicleTypeId: vehicleType.id,
        baseFare: item.baseFare,
        perKmFare: item.perKmFare,
        perMinuteFare: item.perMinuteFare,
        minimumFare: item.baseFare,
        peakMultiplier: 1
      }
    });
  }

  await prisma.pricingContext.upsert({
    where: { id: "GLOBAL" },
    create: { id: "GLOBAL", weatherCondition: "NORMAL" },
    update: {}
  });

  const surchargeRules = [
    {
      name: "Gio cao diem sang",
      type: "PEAK_HOUR" as const,
      multiplier: 1.2,
      startMinute: 7 * 60,
      endMinute: 9 * 60,
      daysOfWeek: "1,2,3,4,5"
    },
    {
      name: "Gio cao diem chieu",
      type: "PEAK_HOUR" as const,
      multiplier: 1.2,
      startMinute: 17 * 60,
      endMinute: 19 * 60,
      daysOfWeek: "1,2,3,4,5"
    },
    {
      name: "Dem khuya",
      type: "LATE_NIGHT" as const,
      multiplier: 1.15,
      startMinute: 22 * 60,
      endMinute: 5 * 60
    },
    { name: "Troi mua", type: "WEATHER" as const, multiplier: 1.15, weatherConditions: "RAIN,HEAVY_RAIN" },
    { name: "Ngap lut", type: "WEATHER" as const, multiplier: 1.3, weatherConditions: "FLOOD" }
  ];
  for (const rule of surchargeRules) {
    const existing = await prisma.surchargeRule.findFirst({
      where: { name: rule.name, vehicleTypeId: null }
    });
    if (existing) await prisma.surchargeRule.update({ where: { id: existing.id }, data: rule });
    else await prisma.surchargeRule.create({ data: rule });
  }

  const adminPhone = process.env.DEFAULT_ADMIN_PHONE ?? "0900000000";
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? "Admin@123456";
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: { passwordHash, fullName: "System Admin" },
    create: {
      phone: adminPhone,
      passwordHash,
      fullName: "System Admin",
      roles: {
        create: {
          roleId: adminRole.id
        }
      }
    }
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: adminRole.id
      }
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: adminRole.id
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
