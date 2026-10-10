import { useState, type FormEvent } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { Brand } from "../components/Brand";
import { Feedback } from "../components/LiveUI";
import { mutate, saveSession } from "../services/api";
import type { AuthResult } from "../types";
export function Login() {
  const [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      saveSession(await mutate<AuthResult>(register ? "/auth/register" : "/auth/login", values));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <form className="auth-form" onSubmit={submit}>
        <Brand />
        <h1>{register ? "Tạo tài khoản" : "Đăng nhập GoRide"}</h1>
        {register && (
          <label>
            Họ và tên
            <input name="fullName" required minLength={2} autoComplete="name" />
          </label>
        )}
        <label>
          Số điện thoại
          <input name="phone" type="tel" required minLength={9} maxLength={15} autoComplete="username" />
        </label>
        <label>
          Mật khẩu
          <input
            name="password"
            type="password"
            required
            minLength={6}
            maxLength={100}
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        <Feedback error={error} />
        <button className="primary-button" disabled={busy}>
          {register ? <UserPlus size={18} /> : <LogIn size={18} />}{" "}
          {busy ? "Đang xử lý..." : register ? "Tạo tài khoản" : "Đăng nhập"}
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}
        </button>
      </form>
    </main>
  );
}
