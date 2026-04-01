"use client";

import { MoreHorizontal, Plus, Shield } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select-native";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ASSIGNABLE_ROLES,
  HUB_MODULE_IDS,
  MODULE_LABELS,
  formatRoleLabel,
  type HubModuleId,
} from "@/lib/permissions";
import type { RolePermissionRow } from "@/lib/role-permissions-fetch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ApiUser = {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  banned_until: string | null;
  last_sign_in_at: string | null;
  created_at: string | null;
  profile_role: string | null;
  profile_created_at: string | null;
};

const ROLE_OPTIONS = [
  "admin",
  "gerencia",
  ...ASSIGNABLE_ROLES.filter((r) => r !== "admin" && r !== "gerencia"),
];

const MATRIX_ROLES = Array.from(new Set(ROLE_OPTIONS));

function userStatus(u: ApiUser): "Confirmado" | "Pendiente" | "Suspendido" {
  if (u.banned_until) {
    const t = new Date(u.banned_until).getTime();
    if (!Number.isNaN(t) && t > Date.now()) return "Suspendido";
  }
  if (u.email_confirmed_at) return "Confirmado";
  return "Pendiente";
}

export function UsersManagementPanel() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [matrix, setMatrix] = useState<
    Record<string, Partial<Record<HubModuleId, boolean>>>
  >({});
  const [matrixLoading, setMatrixLoading] = useState(true);
  const [matrixSaving, setMatrixSaving] = useState(false);
  const [matrixMsg, setMatrixMsg] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState("comercial");
  const [addBusy, setAddBusy] = useState(false);

  const [pwdUser, setPwdUser] = useState<ApiUser | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  const [delUser, setDelUser] = useState<ApiUser | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = (await res.json()) as { users?: ApiUser[]; error?: string };
      if (!res.ok) {
        setLoadError(data.error ?? "Error al cargar usuarios");
        setUsers([]);
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setLoadError("No se pudo conectar con el servidor.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMatrix = useCallback(async () => {
    setMatrixLoading(true);
    setMatrixMsg(null);
    try {
      const res = await fetch("/api/admin/role-permissions");
      const data = (await res.json()) as {
        rows?: RolePermissionRow[];
        error?: string;
      };
      if (!res.ok) {
        setMatrixMsg(data.error ?? "Error al cargar permisos");
        return;
      }
      const next: Record<string, Partial<Record<HubModuleId, boolean>>> = {};
      for (const r of MATRIX_ROLES) {
        next[r] = {};
        for (const m of HUB_MODULE_IDS) {
          next[r]![m] = false;
        }
      }
      for (const row of data.rows ?? []) {
        if (!next[row.role]) next[row.role] = {};
        next[row.role]![row.module_name as HubModuleId] = row.is_enabled;
      }
      setMatrix(next);
    } catch {
      setMatrixMsg("Error de red al cargar la matriz.");
    } finally {
      setMatrixLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
    void loadMatrix();
  }, [loadUsers, loadMatrix]);

  const saveMatrix = async () => {
    setMatrixSaving(true);
    setMatrixMsg(null);
    try {
      const res = await fetch("/api/admin/role-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrix }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMatrixMsg(data.error ?? "Error al guardar");
        return;
      }
      setMatrixMsg("Permisos guardados correctamente.");
    } catch {
      setMatrixMsg("Error al guardar.");
    } finally {
      setMatrixSaving(false);
    }
  };

  const patchRole = async (userId: string, role: string) => {
    const res = await fetch(`/api/admin/users/${userId}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      toast.error(j.error ?? "No se pudo actualizar el rol");
      void loadUsers();
      return;
    }
    toast.success("Rol actualizado");
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, profile_role: role } : u
      )
    );
  };

  const sendRecovery = async (u: ApiUser) => {
    const res = await fetch(`/api/admin/users/${u.id}/recovery`, {
      method: "POST",
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Error al enviar recuperación");
      return;
    }
    toast.success(
      "Email de recuperación enviado (si el SMTP está configurado en Supabase)."
    );
  };

  const setPassword = async () => {
    if (!pwdUser || pwdValue.length < 6) return;
    setPwdBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${pwdUser.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwdValue }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo cambiar la contraseña");
        return;
      }
      toast.success("Contraseña actualizada");
      setPwdUser(null);
      setPwdValue("");
    } finally {
      setPwdBusy(false);
    }
  };

  const deleteUser = async () => {
    if (!delUser) return;
    setDelBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${delUser.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo eliminar el usuario");
        return;
      }
      toast.success("Usuario eliminado");
      setDelUser(null);
      void loadUsers();
    } finally {
      setDelBusy(false);
    }
  };

  const toggleBan = async (u: ApiUser, banned: boolean) => {
    const res = await fetch(`/api/admin/users/${u.id}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ banned }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "No se pudo cambiar el estado de la cuenta");
      return;
    }
    toast.success(banned ? "Acceso suspendido" : "Acceso reactivado");
    void loadUsers();
  };

  const createUser = async () => {
    setAddBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: addEmail.trim(),
          password: addPassword,
          role: addRole,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Error al crear usuario");
        return;
      }
      toast.success("Usuario creado y confirmado");
      setAddOpen(false);
      setAddEmail("");
      setAddPassword("");
      setAddRole("comercial");
      void loadUsers();
    } finally {
      setAddBusy(false);
    }
  };

  const toggleMatrix = (role: string, mod: HubModuleId, v: boolean) => {
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...prev[role], [mod]: v },
    }));
  };

  const matrixRolesSorted = useMemo(
    () => [...MATRIX_ROLES].sort(),
    []
  );

  return (
    <div className="space-y-10">
      <Tabs defaultValue="usuarios" className="w-full gap-6">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="permisos">Matriz de permisos</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-4 outline-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Gestión centralizada con permisos de administrador (service role).
            </p>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="size-4" aria-hidden />
              Añadir usuario
            </Button>
          </div>

          {loadError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {loadError}
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="min-w-[10rem]">Rol</TableHead>
                  <TableHead className="hidden md:table-cell">Alta</TableHead>
                  <TableHead className="w-[3rem] text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No hay usuarios.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="max-w-[14rem] truncate font-medium">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-medium",
                            userStatus(u) === "Confirmado" &&
                              "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100",
                            userStatus(u) === "Pendiente" &&
                              "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
                            userStatus(u) === "Suspendido" &&
                              "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                          )}
                        >
                          {userStatus(u)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <NativeSelect
                          aria-label={`Rol de ${u.email}`}
                          options={ROLE_OPTIONS.map((r) => ({
                            value: r,
                            label: formatRoleLabel(r),
                          }))}
                          value={u.profile_role ?? "comercial"}
                          onChange={(e) => void patchRole(u.id, e.target.value)}
                          className="h-8 min-w-[8rem] text-xs"
                        />
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {u.profile_created_at
                          ? new Date(u.profile_created_at).toLocaleDateString(
                              "es-ES"
                            )
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted"
                            aria-label="Acciones"
                          >
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem
                              onClick={() => void sendRecovery(u)}
                            >
                              Enviar reset de contraseña
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setPwdUser(u);
                                setPwdValue("");
                              }}
                            >
                              Cambiar contraseña…
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => void toggleBan(u, true)}
                              disabled={userStatus(u) === "Suspendido"}
                            >
                              Suspender acceso
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void toggleBan(u, false)}
                              disabled={userStatus(u) !== "Suspendido"}
                            >
                              Reactivar acceso
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDelUser(u)}
                            >
                              Eliminar usuario…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="permisos" className="space-y-4 outline-none">
          <div className="flex items-start gap-2 rounded-lg border border-[var(--minerva-navy)]/15 bg-[var(--minerva-navy)]/[0.04] px-3 py-2 text-sm text-foreground">
            <Shield className="mt-0.5 size-4 shrink-0 text-[var(--minerva-navy)]" />
            <p>
              Los cambios se guardan en{" "}
              <code className="rounded bg-muted px-1 text-xs">
                public.role_permissions
              </code>
              . El Hub y el middleware los aplican en la siguiente petición.
            </p>
          </div>
          {matrixMsg && (
            <p className="text-sm text-muted-foreground" role="status">
              {matrixMsg}
            </p>
          )}
          {matrixLoading ? (
            <p className="text-sm text-muted-foreground">Cargando matriz…</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card p-3 shadow-sm">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-border p-2 text-left font-medium">
                      Rol
                    </th>
                    {HUB_MODULE_IDS.map((m) => (
                      <th
                        key={m}
                        className="border-b border-border p-2 text-center font-medium"
                      >
                        {MODULE_LABELS[m]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixRolesSorted.map((role) => (
                    <tr key={role}>
                      <td className="border-b border-border/60 p-2 font-medium">
                        {formatRoleLabel(role)}
                      </td>
                      {HUB_MODULE_IDS.map((mod) => (
                        <td
                          key={mod}
                          className="border-b border-border/60 p-2 text-center"
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--minerva-navy)]"
                            checked={matrix[role]?.[mod] === true}
                            onChange={(e) =>
                              toggleMatrix(role, mod, e.target.checked)
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  disabled={matrixSaving}
                  onClick={() => void saveMatrix()}
                >
                  {matrixSaving ? "Guardando…" : "Guardar permisos"}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {addOpen && (
        <ModalOverlay onClose={() => !addBusy && setAddOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="font-heading text-lg font-semibold text-[var(--minerva-navy)]">
              Nuevo usuario
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Se crea en Auth con email confirmado y fila en{" "}
              <code className="text-xs">profiles</code>.
            </p>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="nu-email">Email</Label>
                <Input
                  id="nu-email"
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nu-pw">Contraseña</Label>
                <Input
                  id="nu-pw"
                  type="password"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                />
              </div>
              <NativeSelect
                label="Rol"
                options={ROLE_OPTIONS.map((r) => ({
                  value: r,
                  label: formatRoleLabel(r),
                }))}
                value={addRole}
                onChange={(e) => setAddRole(e.target.value)}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={addBusy}
                onClick={() => setAddOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={addBusy}
                onClick={() => void createUser()}
              >
                {addBusy ? "Creando…" : "Crear usuario"}
              </Button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {pwdUser && (
        <ModalOverlay onClose={() => !pwdBusy && setPwdUser(null)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="font-heading text-lg font-semibold">
              Nueva contraseña
            </h3>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {pwdUser.email}
            </p>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="npw">Contraseña (mín. 6 caracteres)</Label>
              <Input
                id="npw"
                type="password"
                value={pwdValue}
                onChange={(e) => setPwdValue(e.target.value)}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pwdBusy}
                onClick={() => setPwdUser(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pwdBusy || pwdValue.length < 6}
                onClick={() => void setPassword()}
              >
                Guardar
              </Button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {delUser && (
        <ModalOverlay onClose={() => !delBusy && setDelUser(null)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="font-heading text-lg font-semibold text-destructive">
              Eliminar usuario
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Se eliminará de Auth y de{" "}
              <code className="text-xs">profiles</code>. Esta acción no se puede
              deshacer.
            </p>
            <p className="mt-2 font-medium">{delUser.email}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={delBusy}
                onClick={() => setDelUser(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={delBusy}
                onClick={() => void deleteUser()}
              >
                {delBusy ? "Eliminando…" : "Eliminar"}
              </Button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
