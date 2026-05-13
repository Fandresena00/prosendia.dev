/*
  Warnings:

  - A unique constraint covering the columns `[businessProfileId,clientPsid]` on the table `conversations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "conversations_businessProfileId_clientPsid_key" ON "conversations"("businessProfileId", "clientPsid");
