import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Leaf } from 'lucide-react';
import { login, type SessionUser } from '../lib/api';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Field, ErrorNotice, SubmitButton } from '../components/forms';

const schema = z.object({
  email: z.email('Masukkan email yang valid.'),
  password: z.string().min(1, 'Isi password.'),
});
export function Login({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [error, setError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary p-3 text-white">
            <Leaf size={28} />
          </div>
          <div>
            <p className="text-xl font-bold">Teh Coyo</p>
            <p className="text-sm text-muted-foreground">Operasional yang lebih terhubung</p>
          </div>
        </div>
        <Card className="space-y-5 p-6">
          <div>
            <h1 className="text-2xl font-bold">Selamat datang 👋</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Masuk dengan akun yang diberikan admin.
            </p>
          </div>
          <form
            className="space-y-4"
            onSubmit={handleSubmit(async (data) => {
              setError(null);
              try {
                onLogin(await login(data.email, data.password));
              } catch (error) {
                setError(error);
              }
            })}
          >
            <Field label="Email">
              <Input type="email" autoComplete="username" {...register('email')} />
              {errors.email && <span className="text-red-700">{errors.email.message}</span>}
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" {...register('password')} />
              {errors.password && <span className="text-red-700">{errors.password.message}</span>}
            </Field>
            <ErrorNotice error={error} />
            <SubmitButton pending={isSubmitting}>Masuk ke aplikasi</SubmitButton>
          </form>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          Tahap fondasi · POS dan penjualan offline belum aktif.
        </p>
      </div>
    </main>
  );
}
