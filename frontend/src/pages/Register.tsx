import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Select } from "../components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { useAuth } from "../context/AuthContext";
import { extractErrorMessage } from "../api/client";
import { Truck, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";
import type { UserRole } from "../types/api";
import { toast } from "sonner";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  role: z.enum(["admin", "transporter", "warehouse_operator", "distributor", "receiver", "viewer"]),
  wallet_address: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

const roleOptions: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin - Can create shipments, assign transporters" },
  { value: "transporter", label: "Transporter - Can record pickup, checkpoints, transfer custody" },
  { value: "warehouse_operator", label: "Warehouse Operator - Can accept custody, record checkpoints" },
  { value: "distributor", label: "Distributor - Can accept custody, record checkpoints" },
  { value: "receiver", label: "Receiver - Can mark delivery" },
  { value: "viewer", label: "Viewer - Read-only access" },
];

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "viewer",
    },
  });

  const selectedRole = watch("role");

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setError(null);
    try {
      await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        wallet_address: data.wallet_address || undefined,
      });
      toast.success("Account created successfully!");
      navigate("/dashboard");
    } catch (err) {
      const message = extractErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Truck className="h-7 w-7" />
          </div>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Create your decentralized identity on ChainRoute</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className={cn("p-3 rounded-lg text-sm", "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300")}>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                {...register("name")}
                disabled={isLoading}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                {...register("email")}
                disabled={isLoading}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
                disabled={isLoading}
                aria-invalid={!!errors.password}
              />
              {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...register("confirmPassword")}
                disabled={isLoading}
                aria-invalid={!!errors.confirmPassword}
              />
              {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                id="role"
                {...register("role")}
                disabled={isLoading}
                aria-invalid={!!errors.role}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {errors.role && <p className="text-sm text-red-500">{errors.role.message}</p>}
            </div>

            {(selectedRole === "transporter" || selectedRole === "warehouse_operator" || 
              selectedRole === "distributor" || selectedRole === "receiver") && (
              <div className="space-y-2">
                <Label htmlFor="wallet_address">Wallet Address (Optional)</Label>
                <Input
                  id="wallet_address"
                  placeholder="0x..."
                  {...register("wallet_address")}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Required for participating in shipments. Can be added later in My Identity.
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}