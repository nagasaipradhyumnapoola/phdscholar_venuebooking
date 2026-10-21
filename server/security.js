import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export const token = () => randomBytes(32).toString("hex");
export const digest = (v) => createHash("sha256").update(v).digest("hex");
export async function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(value, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${salt}$${hash.toString("hex")}`;
}
export async function verifyPassword(value, stored) {
  const [, salt, hex] = stored.split("$");
  const computed = await derive(value, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  const expected = Buffer.from(hex, "hex");
  return (
    expected.length === computed.length && timingSafeEqual(expected, computed)
  );
}
export const publicUser = ({
  id,
  name,
  email,
  role,
  faculty_id,
  department_id,
}) => ({ id, name, email, role, faculty_id, department_id });
