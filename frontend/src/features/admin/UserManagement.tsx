import { useEffect, useState } from "react";
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  type AdminUser,
} from "@/services/userService";
import {
  Loader2,
  Pencil,
  Trash2,
  UserPlus,
  Check,
  X,
  ShieldCheck,
  User,
} from "lucide-react";

// ─── tiny helpers ─────────────────────────────────────────────────────────────

function Badge({ role }: { role: AdminUser["role"] }) {
  return role === "admin" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent/20 text-accent">
      <ShieldCheck className="h-3 w-3" />
      admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
      <User className="h-3 w-3" />
      authorized
    </span>
  );
}

// ─── EditRow ──────────────────────────────────────────────────────────────────

interface EditRowProps {
  user: AdminUser;
  onSave: (id: string, username: string, password: string) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function EditRow({ user, onSave, onCancel, saving }: EditRowProps) {
  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState("");

  const handleSave = () => {
    const payload = {
      username: username.trim() !== user.username ? username.trim() : undefined,
      password: password !== "" ? password : undefined,
    };
    if (!payload.username && !payload.password) {
      onCancel();
      return;
    }
    onSave(user.id, username.trim(), password);
  };

  return (
    <tr className="bg-muted/40">
      <td className="px-4 py-2 text-xs text-muted-foreground font-mono">{user.id.slice(0, 8)}…</td>
      <td className="px-4 py-2">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-2 py-1 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Username"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-2 py-1 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="New password (leave blank to keep)"
        />
      </td>
      <td className="px-4 py-2">
        <Badge role={user.role} />
      </td>
      <td className="px-4 py-2 text-xs text-muted-foreground">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1.5 rounded hover:bg-accent/20 text-accent disabled:opacity-50"
            title="Save"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-50"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── AddUserForm ──────────────────────────────────────────────────────────────

interface AddUserFormProps {
  onAdd: (username: string, password: string, role: "authorized" | "admin") => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function AddUserForm({ onAdd, onCancel, saving }: AddUserFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"authorized" | "admin">("authorized");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(username.trim(), password, role);
  };

  return (
    <tr className="bg-accent/5 border-t-2 border-accent/30">
      <td className="px-4 py-2 text-xs text-muted-foreground">new</td>
      <td className="px-4 py-2">
        <input
          autoFocus
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-2 py-1 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Username"
          required
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-2 py-1 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Password (min 8 chars)"
          required
        />
      </td>
      <td className="px-4 py-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "authorized" | "admin")}
          className="px-2 py-1 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="authorized">authorized</option>
          <option value="admin">admin</option>
        </select>
      </td>
      <td className="px-4 py-2 text-xs text-muted-foreground">—</td>
      <td className="px-4 py-2">
        <div className="flex gap-1">
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={saving || !username.trim() || password.length < 8}
            className="p-1.5 rounded hover:bg-accent/20 text-accent disabled:opacity-50"
            title="Create user"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-50"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── UserManagement ───────────────────────────────────────────────────────────

const UserManagement = () => {
  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [feedback, setFeedback]     = useState<{ text: string; type: "success" | "error" } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await fetchUsers());
    } catch {
      setError("Failed to load users. Ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showMsg = (text: string, type: "success" | "error") => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleSave = async (id: string, username: string, password: string) => {
    setSaving(true);
    try {
      const updated = await updateUser(id, {
        username: username !== users.find((u) => u.id === id)?.username ? username : undefined,
        password: password || undefined,
      });
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      setEditingId(null);
      showMsg("User updated successfully.", "success");
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "Failed to update user.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (username: string, password: string, role: "authorized" | "admin") => {
    setSaving(true);
    try {
      const created = await createUser({ username, password, role });
      setUsers((prev) => [created, ...prev]);
      setShowAdd(false);
      showMsg(`User "${created.username}" created.`, "success");
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "Failed to create user.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      showMsg(`User "${username}" deleted.`, "success");
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "Failed to delete user.", "error");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${users.length} user${users.length !== 1 ? "s" : ""}`}
        </p>
        <button
          onClick={() => { setShowAdd(true); setEditingId(null); }}
          disabled={showAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add User
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`px-3 py-2 rounded-md text-sm ${
            feedback.type === "success"
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="px-3 py-2 rounded-md text-sm bg-destructive/10 text-destructive">
          {error}
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">ID</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Username</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Password</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {showAdd && (
                <AddUserForm
                  onAdd={handleAdd}
                  onCancel={() => setShowAdd(false)}
                  saving={saving}
                />
              )}
              {users.length === 0 && !showAdd && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
              {users.map((user) =>
                editingId === user.id ? (
                  <EditRow
                    key={user.id}
                    user={user}
                    onSave={handleSave}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                ) : (
                  <tr key={user.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                      {user.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-2.5 font-medium">{user.username}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs tracking-widest">••••••••</td>
                    <td className="px-4 py-2.5">
                      <Badge role={user.role} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingId(user.id); setShowAdd(false); }}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id, user.username)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading users…
        </div>
      )}
    </div>
  );
};

export default UserManagement;
