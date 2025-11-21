'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import { 
  getAllProjects, 
  getProjectById, 
  createProject, 
  addLandRecordToProject,
  updateProject 
} from '@/lib/supabase';
import LandRecordTimeline from '@/components/LandRecordTimeline';
import { Plus, FolderOpen, MapPin, Calendar, User, Search, Edit, ArrowLeft, Trash2, Download } from 'lucide-react';
import { exportProjectsToExcel } from '@/lib/supabase-exports';

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_by_email: string;
  land_record_ids: string[];
  created_at: string;
  updated_at: string;
  is_individual?: boolean;
}

interface LandRecord {
  id: string;
  status: string;
  district: string;
  taluka: string;
  village: string;
  block_no: string;
  created_at: string;
}

export default function ProjectsPage() {
  const { user } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
const [selectedLandRecord, setSelectedLandRecord] = useState<LandRecord | null>(null);
const [landRecords, setLandRecords] = useState<LandRecord[]>([]);
const [availableLandRecords, setAvailableLandRecords] = useState<LandRecord[]>([]);
const [loading, setLoading] = useState(true);
  const [creatingProject, setCreatingProject] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [addingLandRecord, setAddingLandRecord] = useState(false);
  const [updatingProject, setUpdatingProject] = useState(false);

  // Fetch projects and land records on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // 3. Update fetchData to properly handle all land records as individual projects
const fetchData = async () => {
  try {
    setLoading(true);
    const [projectsData, landRecordsData] = await Promise.all([
      getAllProjects(supabase),
      supabase.from('land_records').select('*').order('created_at', { ascending: false })
    ]);

    const dbProjects = projectsData || [];
    const allLandRecords = landRecordsData.data || [];
    
    // Get all land IDs that are in project clusters
    const landIdsInClusters = new Set(
      dbProjects.flatMap(project => project.land_record_ids || [])
    );
    
    // Create individual projects for land records NOT in any cluster
    const individualProjects = allLandRecords
      .filter(record => !landIdsInClusters.has(record.id))
      .map(record => ({
        id: `individual_${record.id}`,
        name: `${record.village}, Block No: ${record.block_no}`,
        description: `Taluk: ${record.taluka} | District: ${record.district}`,
        created_by_email: record.user_email || 'system',
        created_at: record.created_at,
        land_record_ids: [record.id],
        is_individual: true
      }));

    // Combine cluster projects and individual projects
    const allProjects = [...dbProjects, ...individualProjects];
    setProjects(allProjects);
    setLandRecords(allLandRecords);
    
    // Available land records: only those NOT in any cluster
    const available = allLandRecords.filter(
      record => !landIdsInClusters.has(record.id)
    );
    setAvailableLandRecords(available);

  } catch (error) {
    console.error('Error fetching data:', error);
  } finally {
    setLoading(false);
  }
};
  // 2. Use useMemo to get selected project (prevents unnecessary re-renders)
const selectedProject = useMemo(() => {
  return projects.find(p => p.id === selectedProjectId) || null;
}, [projects, selectedProjectId]);


  const handleCreateProject = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!newProjectName.trim() || !user?.primaryEmailAddress?.emailAddress) return;

  try {
    setCreatingProject(true);
    const projectData = {
      name: newProjectName.trim(),
      description: newProjectDescription.trim() || null,
      created_by_email: user.primaryEmailAddress.emailAddress,
      land_record_ids: []
    };

    const newProject = await createProject(supabase, projectData);
    setProjects(prev => [newProject, ...prev]);
    setSelectedProjectId(newProject.id);
    setNewProjectName('');
    setNewProjectDescription('');
    setShowCreateForm(false);
    
    await fetchData();
  } catch (error) {
    console.error('Error creating project:', error);
    alert('Failed to create project. Please try again.');
  } finally {
    setCreatingProject(false);
  }
};


  const handleEditProject = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!selectedProject || !editProjectName.trim() || selectedProject.is_individual) return;

  try {
    setUpdatingProject(true);
    const updates = {
      name: editProjectName.trim(),
      description: editProjectDescription.trim() || null
    };

    const updatedProject = await updateProject(supabase, selectedProject.id, updates);
    setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProject : p));
    setShowEditForm(false);
    await fetchData();
  } catch (error) {
    console.error('Error updating project:', error);
    alert('Failed to update project. Please try again.');
  } finally {
    setUpdatingProject(false);
  }
};

  const handleAddLandRecord = async (landRecordId: string) => {
  if (!selectedProject || selectedProject.is_individual) return;

  try {
    setAddingLandRecord(true);
    await addLandRecordToProject(supabase, selectedProject.id, landRecordId);
    await fetchData();
  } catch (error) {
    console.error('Error adding land record:', error);
    alert('Failed to add land record to project. Please try again.');
  } finally {
    setAddingLandRecord(false);
  }
};

const handleExportToExcel = async () => {
  try {
    // Prepare data for export
    const exportData = [];
    
    // Process cluster projects
    const clusterProjects = projects.filter(p => !p.is_individual);
    
    for (const project of clusterProjects) {
      const projectLandRecords = landRecords.filter(record =>
        project.land_record_ids?.includes(record.id)
      );
      
      if (projectLandRecords.length > 0) {
        // Add project lands - only show project name for first land
        projectLandRecords.forEach((record, index) => {
          exportData.push({
            projectName: index === 0 ? project.name : '', // Only show name for first record
            district: record.district,
            taluk: record.taluka,
            village: record.village,
            blockNo: record.block_no,
           resurveyNo: record.re_survey_no || 'N/A',
            status: record.status === 'review2' ? 'External Review' : 
                    record.status.charAt(0).toUpperCase() + record.status.slice(1)
          });
        });
      } else {
        // Project has no lands - add project name only
        exportData.push({
          projectName: project.name,
          district: '',
          taluk: '',
          village: '',
          blockNo: '',
          resurveyNo: '',
          status: ''
        });
      }
    }
    
    // Add "Individual Projects" header
    exportData.push({
      projectName: 'INDIVIDUAL PROJECTS',
      district: '',
      taluk: '',
      village: '',
      blockNo: '',
      resurveyNo: '',
      status: '',
      isHeader: true // Flag to identify this as a header row
    });
    
    // Process individual land records (not in any cluster)
    const individualProjects = projects.filter(p => p.is_individual);
    for (const project of individualProjects) {
      const record = landRecords.find(r => r.id === project.land_record_ids?.[0]);
      if (record) {
        exportData.push({
          projectName: '',
          district: record.district,
          taluk: record.taluka,
          village: record.village,
          blockNo: record.block_no,
         resurveyNo: record.re_survey_no || 'N/A',
          status: record.status === 'review2' ? 'External Review' : 
                  record.status.charAt(0).toUpperCase() + record.status.slice(1)
        });
      }
    }
    
    await exportProjectsToExcel(exportData);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('Failed to export data. Please try again.');
  }
};
  
 const handleRemoveLandRecord = async (landRecordId: string) => {
  if (!selectedProject || selectedProject.is_individual) return;

  try {
    const updatedIds = selectedProject.land_record_ids?.filter(id => id !== landRecordId) || [];
    const updates = {
      land_record_ids: updatedIds
    };

    await updateProject(supabase, selectedProject.id, updates);
    await fetchData();
  } catch (error) {
    console.error('Error removing land record:', error);
    alert('Failed to remove land record from project. Please try again.');
  }
};


  const openEditForm = () => {
  if (selectedProject && !selectedProject.is_individual) {
    setEditProjectName(selectedProject.name);
    setEditProjectDescription(selectedProject.description || '');
    setShowEditForm(true);
  } else if (selectedProject?.is_individual) {
    alert('Individual land records cannot be edited from here. Please edit from Land Master.');
  }
};


  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProjectLandRecords = () => {
    if (!selectedProject) return [];
    return landRecords.filter(record =>
      selectedProject.land_record_ids?.includes(record.id)
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading projects...</div>
      </div>
    );
  }

  // If a land record is selected, show its timeline
  if (selectedLandRecord) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Back to Project Header */}
          <div className="mb-6">
            <button
              onClick={() => setSelectedLandRecord(null)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Project
            </button>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedLandRecord.village}, {selectedLandRecord.block_no}
              </h1>
              <p className="text-gray-600">
                Project: {selectedProject?.name} • Taluk: {selectedLandRecord.taluka} • District: {selectedLandRecord.district}
              </p>
            </div>
          </div>

          {/* Timeline Component */}
          <LandRecordTimeline 
            landId={selectedLandRecord.id} 
            showHeader={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
    <div>
      <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
      <p className="text-gray-600 mt-2">
        Manage collections of land records and track their progress
      </p>
    </div>
    <div className="flex gap-3">
      <button
        onClick={handleExportToExcel}
        disabled={projects.length === 0}
        className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        <Download className="h-5 w-5" />
        Export to Excel
      </button>
      <button
        onClick={() => setShowCreateForm(true)}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
      >
        <Plus className="h-5 w-5" />
        New Project
      </button>
    </div>
  </div>

  {/* Search Bar */}
  <div className="max-w-md">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="text"
        placeholder="Search projects..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  </div>
</div>

        {/* Create Project Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-semibold mb-4">Create New Project</h2>
              <form onSubmit={handleCreateProject}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter project name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newProjectDescription}
                      onChange={(e) => setNewProjectDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Project description (optional)"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingProject || !newProjectName.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {creatingProject ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Project Modal */}
        {showEditForm && selectedProject && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-semibold mb-4">Edit Project</h2>
              <form onSubmit={handleEditProject}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      value={editProjectName}
                      onChange={(e) => setEditProjectName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter project name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={editProjectDescription}
                      onChange={(e) => setEditProjectDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Project description (optional)"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowEditForm(false)}
                    className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingProject || !editProjectName.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {updatingProject ? 'Updating...' : 'Update Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects Sidebar - Updated with Dropdown */}
<div className="lg:col-span-1">
  <div className="bg-white rounded-lg shadow-sm border border-gray-200">
    <div className="p-4 border-b border-gray-200">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <FolderOpen className="h-5 w-5 text-blue-600" />
        All Projects ({filteredProjects.length})
      </h2>
      <p className="text-sm text-gray-600 mt-1">
        Includes project clusters and individual land records
      </p>
    </div>
    
    {/* Dropdown for large lists */}
    <div className="p-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select a Project
      </label>
      <select
        value={selectedProjectId || ''}
        onChange={(e) => setSelectedProjectId(e.target.value || null)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">-- Select a project --</option>
        
        {/* Group by type */}
        <optgroup label="Project Clusters">
          {filteredProjects
            .filter(p => !p.is_individual)
            .map(project => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.land_record_ids?.length || 0} lands)
              </option>
            ))}
        </optgroup>
        
        <optgroup label="Individual Land Records">
          {filteredProjects
            .filter(p => p.is_individual)
            .map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
        </optgroup>
      </select>
    </div>

    {/* Search within dropdown results */}
    <div className="p-4 pt-0">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Filter projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>
    </div>

    {/* Selected Project Preview */}
    {selectedProject && (
      <div className="p-4 bg-blue-50 border-t border-blue-200">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900">{selectedProject.name}</h3>
          {selectedProject.is_individual && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
              Individual
            </span>
          )}
          {!selectedProject.is_individual && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              Cluster
            </span>
          )}
        </div>
        {selectedProject.description && (
          <p className="text-sm text-gray-600 mb-2">
            {selectedProject.description}
          </p>
        )}
        <div className="flex flex-col gap-1 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {selectedProject.land_record_ids?.length || 0} land record(s)
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(selectedProject.created_at).toLocaleDateString('en-GB')}
          </div>
        </div>
      </div>
    )}
  </div>

  {/* Available Land Records - Only show for cluster projects */}
  {selectedProject && !selectedProject.is_individual && availableLandRecords.length > 0 && (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-6">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin className="h-4 w-4 text-green-600" />
          Available Land Records ({availableLandRecords.length})
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Add land records to this cluster
        </p>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {availableLandRecords.map((record) => (
          <div
            key={record.id}
            className="p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-900">
                  {record.village}, {record.block_no}
                </p>
                <p className="text-xs text-gray-500">
                  Taluk: {record.taluka} | District: {record.district}
                </p>
                <p className="text-xs text-gray-500 capitalize">
  Status:{' '}
  {record.status === 'review2'
    ? 'External Review'
    : record.status.charAt(0).toUpperCase() + record.status.slice(1)}
</p>
              </div>
              <button
                onClick={() => handleAddLandRecord(record.id)}
                disabled={addingLandRecord}
                className="ml-2 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )}
</div>

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {selectedProject ? (
              <div className="space-y-6">
                {/* Project Header - Updated */}
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
    <div className="flex-1">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {selectedProject.name}
          </h2>
          {selectedProject.is_individual && (
            <span className="inline-flex items-center gap-1 mt-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              Individual Land Record
            </span>
          )}
        </div>
        {!selectedProject.is_individual && (
          <button
            onClick={openEditForm}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Edit className="h-4 w-4" />
            Edit
          </button>
        )}
      </div>
      {selectedProject.description && (
        <p className="text-gray-600 mb-4">{selectedProject.description}</p>
      )}
      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-1">
          <User className="h-4 w-4" />
          Created by: {selectedProject.created_by_email}
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          Created: {new Date(selectedProject.created_at).toLocaleDateString('en-GB')}
        </div>
        <div className="flex items-center gap-1">
          <MapPin className="h-4 w-4" />
          Land Records: {selectedProject.land_record_ids?.length || 0}
        </div>
        {!selectedProject.is_individual && (
          <div className="flex items-center gap-1">
            <FolderOpen className="h-4 w-4" />
            Type: Project Cluster
          </div>
        )}
      </div>
    </div>
  </div>
</div>

                {/* Project Land Records */}
                {getProjectLandRecords().length > 0 ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold mb-4">
                      Land Records in this Project ({getProjectLandRecords().length})
                    </h3>
                    <div className="space-y-4">
                      {getProjectLandRecords().map((record) => (
                        <div
                          key={record.id}
                          className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors group"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 mb-2">
                                {record.village}, {record.block_no}
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600 mb-3">
                                <div>
                                  <span className="font-medium">Taluk:</span> {record.taluka}
                                </div>
                                <div>
                                  <span className="font-medium">District:</span> {record.district}
                                </div>                             
                                <div>
  <span className="font-medium">Status:</span> 
  <span className="ml-1 capitalize">
    {record.status === 'review2'
      ? 'External Review'
      : record.status.charAt(0).toUpperCase() + record.status.slice(1)}
  </span>
</div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setSelectedLandRecord(record)}
                                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  View Timeline
                                </button>
                                {!selectedProject.is_individual && (
                                <button
                                  onClick={() => handleRemoveLandRecord(record.id)}
                                  className="px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Remove from project"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No Land Records Added
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Add land records from the available list to start tracking their timeline.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <FolderOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  No Project Selected
                </h2>
                <p className="text-gray-600">
                  Select a project from the sidebar or create a new one to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
