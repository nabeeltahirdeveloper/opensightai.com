import React, { useState, useEffect } from 'react';
import UserManagement from './UserManagement';
import AddUserModal from './AddUserModal';
import { createPageUrl } from '@/utils';
import { serverApi } from '@/api/serverApi';

export default function UsersSection() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const users = await serverApi.auth.list();
      setUsers(users || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserUpdate = async () => {
    await loadUsers();
  };

  const handleAddUser = () => {
    setShowAddModal(true);
  };

  const handleUserCreated = async () => {
    setShowAddModal(false);
    await loadUsers();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold gradient-text">User Management</h2>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <button className="action-btn btn-primary w-full sm:w-auto" onClick={handleAddUser}>
            <i className="fas fa-user-plus mr-2"></i>Add User
          </button>
          <button className="action-btn btn-danger w-full sm:w-auto" onClick={() => window.location.href = createPageUrl('Dashboard')}>
            <i className="fas fa-arrow-left mr-2"></i>Switch to User Dashboard
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <i className="fas fa-spinner fa-spin text-4xl text-cyan-400"></i>
          <p className="mt-4 text-gray-400">Loading users...</p>
        </div>
      ) : (
        <UserManagement users={users} onUserUpdate={handleUserUpdate} />
      )}

      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onUserCreated={handleUserCreated}
        />
      )}
    </div>
  );
}
