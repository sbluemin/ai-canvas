import { useState } from 'react';
import './ProjectSelector.css';

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function ProjectSelector() {
  const [selectedProject, setSelectedProject] = useState('AI Canvas');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const projects = ['AI Canvas', 'New Project', 'My Documents'];

  return (
    <div className="project-selector">
      <div
        className="project-dropdown"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <span className="project-name">{selectedProject}</span>
        <ChevronDownIcon />
        {isDropdownOpen && (
          <div className="project-menu">
            {projects.map((project) => (
              <button
                key={project}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedProject(project);
                  setIsDropdownOpen(false);
                }}
                className={project === selectedProject ? 'active' : ''}
              >
                {project}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
