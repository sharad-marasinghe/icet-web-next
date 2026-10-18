import { TrainerForm } from "../trainer-form";
import { connection } from "next/server";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function NewTrainer() {
  await connection();
  return <TrainerForm trainer={null} />;
}
