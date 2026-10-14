import { useState, type FormEvent } from "react";
import { KeyRound, LogIn, UserPlus } from "lucide-react";
import { Brand } from "../components/Brand";
import { Feedback } from "../components/LiveUI";
import { mutate, saveSession } from "../services/api";
import type { AuthResult } from "../types";

type Mode = "login" | "register" | "forgot" | "reset";

export function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetToken, setResetToken] = useState("");

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === "forgot") {
        const result = await mutate<{ accepted: boolean; resetToken?: string }>(
          "/auth/forgot-password",
          values
        );
        if (result.resetToken) {
          setResetToken(result.resetToken);
          setMode("reset");
          setNotice("Môi trường phát triển: mã đặt lại đã được điền tự động.");
        } else {
          setNotice("Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.");
        }
        return;
      }
      if (mode === "reset") {
        await mutate("/auth/reset-password", { ...values, token: resetToken || values.token });
        setResetToken("");
        setMode("login");
        setNotice("Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay.");
        return;
      }
      saveSession(await mutate<AuthResult>(mode === "register" ? "/auth/register" : "/auth/login", values));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const title = {
    login: "Đăng nhập GoRide",
    register: "Tạo tài khoản",
    forgot: "Quên mật khẩu",
    reset: "Đặt lại mật khẩu"
  }[mode];

  return (
    <main className="auth-page">
      <form className="auth-form" onSubmit={submit}>
        <Brand />
        <h1>{title}</h1>
        {mode === "register" && (
          <label>
            Họ và tên
            <input name="fullName" required minLength={2} autoComplete="name" />
          </label>
        )}
        {(mode === "login" || mode === "register") && (
          <label>
            Số điện thoại
            <input name="phone" type="tel" required minLength={9} maxLength={15} autoComplete="username" />
          </label>
        )}
        {mode === "forgot" && (
          <label>
            Số điện thoại hoặc email
            <input name="identifier" required minLength={5} maxLength={191} autoComplete="username" />
          </label>
        )}
        {mode === "reset" && !resetToken && (
          <label>
            Mã đặt lại mật khẩu
            <input name="token" required minLength={40} maxLength={200} autoComplete="one-time-code" />
          </label>
        )}
        {(mode === "login" || mode === "register" || mode === "reset") && (
          <label>
            {mode === "reset" ? "Mật khẩu mới" : "Mật khẩu"}
            <input
              name="password"
              type="password"
              required
              minLength={mode === "reset" ? 8 : 6}
              maxLength={100}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
        )}
        <Feedback error={error} />
        {notice && <p className="success-copy">{notice}</p>}
        <button className="primary-button" disabled={busy}>
          {mode === "register" ? (
            <UserPlus size={18} />
          ) : mode === "login" ? (
            <LogIn size={18} />
          ) : (
            <KeyRound size={18} />
          )}
          {busy
            ? "Đang xử lý..."
            : mode === "register"
              ? "Tạo tài khoản"
              : mode === "login"
                ? "Đăng nhập"
                : mode === "forgot"
                  ? "Gửi hướng dẫn"
                  : "Đặt lại mật khẩu"}
        </button>
        {mode === "login" && (
          <button className="text-button" type="button" onClick={() => switchMode("forgot")}>
            Quên mật khẩu?
          </button>
        )}
        <button
          className="text-button"
          type="button"
          onClick={() => switchMode(mode === "register" ? "login" : mode === "login" ? "register" : "login")}
        >
          {mode === "register"
            ? "Đã có tài khoản? Đăng nhập"
            : mode === "login"
              ? "Chưa có tài khoản? Đăng ký"
              : "Quay lại đăng nhập"}
        </button>
      </form>
    </main>
  );
}
