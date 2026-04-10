-- CreateTable
CREATE TABLE "empresa" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "razon_social" TEXT NOT NULL,
    "nombre_comercial" TEXT,
    "ruc" VARCHAR(11),
    "direccion" TEXT,
    "telefono" VARCHAR(9),
    "correo" TEXT,
    "logo_url" TEXT,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- Seed initial record
INSERT INTO empresa (id, razon_social, nombre_comercial, ruc, direccion, telefono, correo, fecha_actualizacion)
VALUES (1, 'La Cosecha S.A.C.', 'La Cosecha', '20123456789', 'Av. Principal 123, Ate, Lima', '999999999', 'contacto@lacosecha.com', NOW());
