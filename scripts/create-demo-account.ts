import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";

const EMAIL = "demo@tracelens.app";
const PASSWORD = "TraceLens1";
const NAME = "Demo";

const incidents = [
  {
    service: "node-auth-service",
    message: "Cannot read properties of undefined (reading 'email')",
    stackTrace:
      "TypeError: Cannot read properties of undefined (reading 'email')\n    at login (auth-service.js:18:19)",
  },
  {
    service: "checkout-api",
    message: "Cannot read properties of undefined (reading 'price')",
    stackTrace:
      "TypeError: Cannot read properties of undefined (reading 'price')\n    at checkout-api.js:12:28",
  },
  {
    service: "payments-worker",
    message: "connect ECONNREFUSED 127.0.0.1:5432",
    stackTrace: "Error: connect ECONNREFUSED 127.0.0.1:5432\n    at TCPConnectWrap.afterConnect",
  },
  {
    service: "python-orders-api",
    message: "KeyError: 'customer_id'",
    stackTrace:
      'File "/app/orders/views.py", line 84, in create_order\n    customer_id = payload["customer_id"]\nKeyError: \'customer_id\'',
  },
  {
    service: "java-billing-service",
    message: "java.lang.NullPointerException: Cannot invoke Invoice.getAmount() because invoice is null",
    stackTrace:
      "java.lang.NullPointerException: Cannot invoke Invoice.getAmount() because invoice is null\n\tat com.tracelens.billing.InvoiceService.charge(InvoiceService.java:118)",
  },
  {
    service: "go-gateway",
    message: "runtime error: invalid memory address or nil pointer dereference",
    stackTrace:
      "panic: runtime error: invalid memory address or nil pointer dereference\n\tgithub.com/tracelens/gateway/internal/proxy.(*Client).Forward\n\t\t/app/internal/proxy/client.go:91",
  },
  {
    service: "ruby-rails-api",
    message: "ActiveRecord::RecordNotFound: Couldn't find User with 'id'=4041",
    stackTrace:
      "/app/app/controllers/users_controller.rb:18:in `show': Couldn't find User with 'id'=4041",
  },
  {
    service: "php-laravel-api",
    message: 'ErrorException: Attempt to read property "email" on null',
    stackTrace:
      'ErrorException: Attempt to read property "email" on null in /var/www/app/Http/Controllers/ProfileController.php:27',
  },
  {
    service: "dotnet-inventory-api",
    message: "System.NullReferenceException: Object reference not set to an instance of an object.",
    stackTrace:
      "System.NullReferenceException: Object reference not set to an instance of an object.\n   at TraceLens.Inventory.SkuService.ReserveAsync(String sku, Int32 qty) in /src/Inventory/SkuService.cs:line 67",
  },
  {
    service: "rust-ingest-worker",
    message: "thread panicked at 'index out of bounds: the len is 0 but the index is 0'",
    stackTrace:
      "thread 'tokio-runtime-worker' panicked at src/parser.rs:52:21:\nindex out of bounds: the len is 0 but the index is 0",
  },
  {
    service: "swift-ios-client",
    message: "Fatal error: Unexpectedly found nil while unwrapping an Optional value",
    stackTrace:
      "Fatal error: Unexpectedly found nil while unwrapping an Optional value\n0   TraceLensApp  CheckoutViewModel.placeOrder() + 96 (CheckoutViewModel.swift:44)",
  },
  {
    service: "kotlin-android-api",
    message: "IllegalStateException: User session expired",
    stackTrace:
      "java.lang.IllegalStateException: User session expired\n\tat com.tracelens.mobile.SessionStore.requireUser(SessionStore.kt:33)",
  },
];

const deployments = [
  {
    commitHash: "a1c4e90",
    message: "Fix checkout when a cart item has no price",
    author: "demo",
    repository: "tracelens-demo",
    branch: "main",
  },
  {
    commitHash: "b7d21aa",
    message: "Handle missing customer_id on order create",
    author: "demo",
    repository: "tracelens-demo",
    branch: "main",
  },
  {
    commitHash: "c9031ff",
    message: "Guard nil gateway client before proxying",
    author: "demo",
    repository: "tracelens-demo",
    branch: "main",
  },
];

const main = async () => {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { name: NAME, passwordHash, emailVerified: true },
    create: { email: EMAIL, name: NAME, passwordHash, emailVerified: true },
  });

  let project = await prisma.project.findFirst({ where: { userId: user.id } });
  if (!project) {
    project = await prisma.project.create({
      data: { name: "Demo Project", userId: user.id },
    });
  }

  const incidentCount = await prisma.incident.count({ where: { projectId: project.id } });
  if (incidentCount === 0) {
    await prisma.incident.createMany({
      data: incidents.map((incident) => ({ ...incident, projectId: project.id })),
    });
  }

  const deploymentCount = await prisma.deployment.count({ where: { projectId: project.id } });
  if (deploymentCount === 0) {
    await prisma.deployment.createMany({
      data: deployments.map((deployment) => ({ ...deployment, projectId: project.id })),
    });
  }

  const [incidentsNow, deploymentsNow] = await Promise.all([
    prisma.incident.count({ where: { projectId: project.id } }),
    prisma.deployment.count({ where: { projectId: project.id } }),
  ]);

  console.log(
    JSON.stringify({
      email: user.email,
      verified: user.emailVerified,
      project: project.name,
      incidents: incidentsNow,
      deployments: deploymentsNow,
    }),
  );
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
