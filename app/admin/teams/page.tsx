"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, ArrowLeft, AlertCircle, Edit2, Plus } from "lucide-react";
import { apiClient } from "@/lib/api";
import { tabStorage } from "@/lib/storage";

type TeamMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
};

type Team = {
  id: string;
  teamLeaderId: string;
  teamName: string;
  teamLeaderName: string;
  teamLeaderEmail: string;
  teamLeaderPhone?: string | null;
  memberCount: number;
  members: TeamMember[];
};

export default function TeamsManagementPage() {
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  
  // Create Team modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTeamName, setCreateTeamName] = useState("");
  const [createTeamLeaderId, setCreateTeamLeaderId] = useState("");
  const [createTeamMemberIds, setCreateTeamMemberIds] = useState<string[]>([]);
  
  // Edit Team modal
  const [teamName, setTeamName] = useState("");
  const [teamLeaderId, setTeamLeaderId] = useState("");
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [teamsRes, usersRes]: any = await Promise.all([
          apiClient.getTeams(),
          apiClient.getUsers(),
        ]);

        setTeams(teamsRes.teams ?? []);
        setUsers(usersRes.users ?? []);
      } catch (e: any) {
        const errorMessage = e?.message || "Failed to load teams";
        const statusCode = e?.status;
        
        // Only redirect on actual authentication/authorization errors (401/403 status codes)
        if (statusCode === 401 || statusCode === 403) {
          // Clear storage and redirect only for real auth errors
          tabStorage.removeItem("token");
          tabStorage.removeItem("user");
          router.push("/login");
          return;
        }
        
        // For other errors (network, 500, etc.), just show the error message
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const handleOpenEditTeam = (team: Team) => {
    setEditingTeam(team);
    setTeamName(team.teamName || "");
    setTeamLeaderId(team.teamLeaderId);
    setTeamMemberIds(team.members.map((m) => m.id));
    setShowEditModal(true);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTeamLeaderId) {
      setError("Please select a Team Leader");
      return;
    }
    if (!createTeamName.trim()) {
      setError("Please enter a team name");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiClient.updateUser(createTeamLeaderId, {
        teamMemberIds: createTeamMemberIds,
        teamName: createTeamName.trim(),
      } as any);

      const teamsRes: any = await apiClient.getTeams();
      setTeams(teamsRes.teams ?? []);

      setShowCreateModal(false);
      setCreateTeamName("");
      setCreateTeamLeaderId("");
      setCreateTeamMemberIds([]);
    } catch (e: any) {
      setError(e?.message || "Failed to create team");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamLeaderId) {
      setError("Please select a Team Leader");
      return;
    }
    if (!teamName.trim()) {
      setError("Please enter a team name");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiClient.updateUser(teamLeaderId, {
        teamMemberIds,
        teamName: teamName.trim(),
      } as any);

      const teamsRes: any = await apiClient.getTeams();
      setTeams(teamsRes.teams ?? []);

      setShowEditModal(false);
      setEditingTeam(null);
      setTeamName("");
      setTeamLeaderId("");
      setTeamMemberIds([]);
    } catch (e: any) {
      setError(e?.message || "Failed to update team");
    } finally {
      setSubmitting(false);
    }
  };

  const telecallerAndCounselors = users.filter((u) =>
    ["TELECALLER", "COUNSELOR"].includes(u.role?.name)
  );

  const teamLeaders = users.filter((u) => u.role?.name === "TEAM_LEADER");

  return (
    <div className="w-full p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm md:text-base"
      >
        <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
        <span>Back</span>
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-6 w-6 text-primary-600" />
          Team Management
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm md:text-base hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Create Team</span>
        </button>
      </div>

      {loading && <p className="text-gray-600">Loading teams...</p>}

      {error && (
        <div className="flex items-center gap-2 text-red-600 mb-4 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <div>
          {teams.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              No teams found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 md:p-6"
                >
                  {/* Team Name */}
                  <div className="mb-4">
                    <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1">
                      {team.teamName}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="h-4 w-4" />
                      <span>
                        {team.memberCount} member
                        {team.memberCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Team Leader */}
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Team Leader
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {team.teamLeaderName}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {team.teamLeaderEmail}
                    </div>
                  </div>

                  {/* Team Members */}
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Team Members
                    </div>
                    {team.members.length === 0 ? (
                      <div className="text-sm text-gray-400 italic">
                        No members assigned
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {team.members.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center px-2 py-1 text-xs rounded-md bg-primary-50 text-primary-700 border border-primary-200"
                          >
                            {m.firstName} {m.lastName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Edit Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => handleOpenEditTeam(team)}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span>Edit Team</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Create Team
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateTeamName("");
                  setCreateTeamLeaderId("");
                  setCreateTeamMemberIds([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  value={createTeamName}
                  onChange={(e) => setCreateTeamName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="e.g., Team 1, Telecaller Team A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Leader
                </label>
                <select
                  value={createTeamLeaderId}
                  onChange={(e) => setCreateTeamLeaderId(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select Team Leader</option>
                  {teamLeaders.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Members (Telecaller / Counselor)
                </label>
                <div className="border border-gray-300 rounded-md max-h-52 overflow-y-auto px-2 py-1 bg-gray-50">
                  {telecallerAndCounselors.map((u) => {
                    const checked = createTeamMemberIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateTeamMemberIds((prev) => [...prev, u.id]);
                            } else {
                              setCreateTeamMemberIds((prev) =>
                                prev.filter((id) => id !== u.id)
                              );
                            }
                          }}
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                        />
                        <span>
                          {u.firstName} {u.lastName} –{" "}
                          <span className="text-gray-500">
                            {u.role?.name}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateTeamName("");
                    setCreateTeamLeaderId("");
                    setCreateTeamMemberIds([]);
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {showEditModal && editingTeam && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Edit Team
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingTeam(null);
                  setTeamName("");
                  setTeamLeaderId("");
                  setTeamMemberIds([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Leader
                </label>
                <select
                  value={teamLeaderId}
                  onChange={(e) => setTeamLeaderId(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select Team Leader</option>
                  {teamLeaders.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Members (Telecaller / Counselor)
                </label>
                <div className="border border-gray-300 rounded-md max-h-52 overflow-y-auto px-2 py-1 bg-gray-50">
                  {telecallerAndCounselors.map((u) => {
                    const checked = teamMemberIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTeamMemberIds((prev) => [...prev, u.id]);
                            } else {
                              setTeamMemberIds((prev) =>
                                prev.filter((id) => id !== u.id)
                              );
                            }
                          }}
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                        />
                        <span>
                          {u.firstName} {u.lastName} –{" "}
                          <span className="text-gray-500">
                            {u.role?.name}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingTeam(null);
                    setTeamName("");
                    setTeamLeaderId("");
                    setTeamMemberIds([]);
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


