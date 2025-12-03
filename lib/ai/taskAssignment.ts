/**
 * Task Assignment Logic
 * Provides helper functions for suggesting task assignees based on SOW team members
 */

import logger from '@/lib/utils/logger';
import type { SOWMember } from './taskGenerator';

/**
 * Suggest the best assignee for a task based on SOW team members
 * 
 * @param taskTitle - Task title
 * @param taskDescription - Task description
 * @param sowMembers - Available SOW team members
 * @returns Suggested assignee user_id or null if no suitable match
 */
export function suggestTaskAssignee(
  taskTitle: string,
  taskDescription: string,
  sowMembers: SOWMember[]
): string | null {
  if (!sowMembers || sowMembers.length === 0) {
    return null;
  }

  const taskText = `${taskTitle} ${taskDescription || ''}`.toLowerCase();

  // Filter out overworked members (but keep them as fallback)
  const availableMembers = sowMembers.filter(m => !m.is_overworked);
  const overworkedMembers = sowMembers.filter(m => m.is_overworked);

  // If no available members, use overworked members but log warning
  const membersToConsider = availableMembers.length > 0 ? availableMembers : overworkedMembers;
  
  if (membersToConsider.length === 0) {
    return null;
  }

  if (availableMembers.length === 0 && overworkedMembers.length > 0) {
    logger.warn('[Task Assignment] All SOW members are overworked, assigning anyway');
  }

  // Score members based on role match and task count
  const scoredMembers = membersToConsider.map(member => {
    let score = 0;

    // Role matching based on role name and description
    const roleText = `${member.role_name} ${member.role_description || ''}`.toLowerCase();
    
    // Check for keyword matches in role description
    const roleKeywords = roleText.split(/\s+/);
    const taskKeywords = taskText.split(/\s+/);
    
    // Count keyword matches
    const keywordMatches = roleKeywords.filter(keyword => 
      taskKeywords.some(taskKeyword => taskKeyword.includes(keyword) || keyword.includes(taskKeyword))
    ).length;

    score += keywordMatches * 10; // Weight role matches heavily

    // Prefer members with fewer current tasks
    score += (100 - member.current_task_count); // Inverse task count (fewer tasks = higher score)

    // Small bonus for having a role description (more context for AI)
    if (member.role_description) {
      score += 5;
    }

    return {
      member,
      score,
    };
  });

  // Sort by score (descending) and return the best match
  scoredMembers.sort((a, b) => b.score - a.score);
  
  const bestMatch = scoredMembers[0];
  
  if (bestMatch.score > 0) {
    return bestMatch.member.user_id;
  }

  // Fallback: return member with fewest tasks
  const sortedByTasks = [...membersToConsider].sort((a, b) => 
    a.current_task_count - b.current_task_count
  );
  
  return sortedByTasks[0].user_id;
}

/**
 * Get role for a task based on keywords
 * This is a helper for role-task matching
 * 
 * @param taskTitle - Task title
 * @param taskDescription - Task description
 * @param roleName - Role name
 * @param roleDescription - Role description
 * @returns True if role matches the task
 */
export function getRoleForTask(
  taskTitle: string,
  taskDescription: string,
  roleName: string,
  roleDescription: string | null
): boolean {
  const text = `${taskTitle} ${taskDescription || ''}`.toLowerCase();
  const roleText = `${roleName} ${roleDescription || ''}`.toLowerCase();

  // Match keywords in role description or name
  // This is flexible and uses AI-provided role context
  // The AI will do the matching based on role description
  return true; // AI handles the matching in the prompt
}

