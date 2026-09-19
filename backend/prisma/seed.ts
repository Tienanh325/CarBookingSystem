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
