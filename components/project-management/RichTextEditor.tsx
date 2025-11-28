'use client';

import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Box, Paper, MenuList, MenuItem, Avatar, Typography, ListItemAvatar, ListItemText } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { User } from '@/types/project';

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(
  async () => {
    const mod = await import('react-quill');
    // Make Quill available globally for finding instances
    if (typeof window !== 'undefined') {
      try {
        (window as any).Quill = mod.default.Quill;
      } catch (e) {
        // Fallback if Quill is not available
        console.warn('Quill not available on default export');
      }
    }
    return mod;
  },
  { 
    ssr: false,
    loading: () => (
      <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
        Loading editor...
      </Box>
    )
  }
);
import 'react-quill/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  projectMembers?: User[];
  onMentionSelect?: (userId: string, userName: string) => void;
}

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder,
  projectMembers = [],
  onMentionSelect,
}: RichTextEditorProps) {
  const theme = useTheme();
  const quillRef = useRef<any>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [editorReady, setEditorReady] = useState(false);

  // Debug: log when projectMembers changes (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && projectMembers.length > 0) {
      console.log('[RichTextEditor] Project members available:', projectMembers.length, projectMembers.map(m => m.name || m.email));
    }
  }, [projectMembers]);

  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        ['link', 'image'],
        [{ align: [] }],
        ['blockquote', 'code-block'],
        ['clean'],
      ],
    }),
    []
  );

  // Filter project members based on mention query
  const filteredMembers = useMemo(() => {
    if (!mentionQuery) return projectMembers;
    const query = mentionQuery.toLowerCase();
    return projectMembers.filter(
      (member) =>
        member.name?.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query)
    );
  }, [mentionQuery, projectMembers]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [menuPortalContainer, setMenuPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Create a portal container for the mention menu
    const portalContainer = document.createElement('div');
    portalContainer.id = 'mention-menu-portal';
    document.body.appendChild(portalContainer);
    setMenuPortalContainer(portalContainer);
    
    return () => {
      if (document.body.contains(portalContainer)) {
        document.body.removeChild(portalContainer);
      }
    };
  }, []);

  // Debug: log mention menu state (after all dependencies are defined)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const willRender = showMentions && filteredMembers.length > 0 && !!menuPortalContainer;
      console.log('[RichTextEditor] Mention state:', { 
        showMentions, 
        filteredMembersCount: filteredMembers.length, 
        mentionQuery,
        position: mentionPosition,
        hasPortal: !!menuPortalContainer,
        willRender,
        menuItems: filteredMembers.map(m => m.name || m.email)
      });
      
      if (willRender) {
        console.log('[RichTextEditor] Menu should be visible at:', mentionPosition);
        // Check if element exists in DOM
        setTimeout(() => {
          const menuElement = document.querySelector('[data-mention-menu]');
          if (menuElement) {
            const rect = menuElement.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(menuElement as Element);
            console.log('[RichTextEditor] Menu element found in DOM:', {
              exists: true,
              rect,
              display: computedStyle.display,
              visibility: computedStyle.visibility,
              opacity: computedStyle.opacity,
              zIndex: computedStyle.zIndex,
              position: computedStyle.position
            });
          } else {
            console.warn('[RichTextEditor] Menu element NOT found in DOM!');
          }
        }, 100);
      }
    }
  }, [showMentions, filteredMembers.length, mentionQuery, mentionPosition, menuPortalContainer, filteredMembers]);

  const insertMention = useCallback((member: User) => {
    console.log('[RichTextEditor] insertMention called:', { 
      memberId: member.id, 
      memberName: member.name || member.email,
      hasOnMentionSelect: !!onMentionSelect 
    });

    if (!quillRef.current) {
      console.warn('[RichTextEditor] No quillRef.current');
      return;
    }

    const quill = quillRef.current.getEditor();
    if (!quill) {
      console.warn('[RichTextEditor] No quill instance');
      return;
    }

    const selection = quill.getSelection();
    if (!selection) {
      console.warn('[RichTextEditor] No selection');
      return;
    }

    // Get all text up to cursor position
    const text = quill.getText(0, selection.index);
    const atIndex = text.lastIndexOf('@');

    if (atIndex === -1) {
      console.warn('[RichTextEditor] No @ found in text');
      return;
    }

    // Calculate the start position (where @ is)
    const startPos = atIndex;
    const endPos = selection.index;

    // Delete the @ and query text
    quill.deleteText(startPos, endPos - startPos);

    // Insert the mention
    const mentionText = `@${member.name || member.email} `;
    quill.insertText(startPos, mentionText);

    // Move cursor after the mention
    quill.setSelection(startPos + mentionText.length);

    setShowMentions(false);
    setMentionQuery('');

    if (onMentionSelect) {
      console.log('[RichTextEditor] Calling onMentionSelect callback');
      onMentionSelect(member.id, member.name || member.email);
    } else {
      console.warn('[RichTextEditor] onMentionSelect callback not provided');
    }
  }, [onMentionSelect]);

  // Initialize editor reference - wait for ReactQuill to fully initialize
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 50; // Try for up to 5 seconds (50 * 100ms)
    
    const findQuillInstance = () => {
      if (retryCount >= maxRetries) {
        console.warn('[RichTextEditor] Could not find Quill instance after max retries');
        return;
      }
      
      retryCount++;
      
      if (!containerRef.current) {
        setTimeout(findQuillInstance, 100);
        return;
      }
      
      const quillEditorElement = containerRef.current?.querySelector('.ql-editor') as any;
      if (!quillEditorElement) {
        setTimeout(findQuillInstance, 100);
        return;
      }
      
      // ReactQuill attaches the Quill instance to the editor element via __quill
      // But it might also be on the parent .quill container
      let quillInstance = null;
      
      // Try __quill on the editor element
      if (quillEditorElement.__quill) {
        quillInstance = quillEditorElement.__quill;
      }
      
      // Try finding it on the parent container
      if (!quillInstance) {
        const quillContainer = containerRef.current?.querySelector('.quill') as any;
        if (quillContainer && quillContainer.__quill) {
          quillInstance = quillContainer.__quill;
        }
      }
      
      // Try accessing through the element's parent
      if (!quillInstance && quillEditorElement.parentElement) {
        const parent = quillEditorElement.parentElement as any;
        if (parent.__quill) {
          quillInstance = parent.__quill;
        }
      }
      
      if (quillInstance) {
        // Verify it's a valid Quill instance
        if (typeof quillInstance.getSelection === 'function' && typeof quillInstance.getText === 'function') {
          console.log('[RichTextEditor] Quill instance found and stored');
          quillRef.current = { 
            getEditor: () => quillInstance,
          };
          setEditorReady(true);
          return;
        } else {
          console.warn('[RichTextEditor] Found __quill but missing methods:', {
            hasGetSelection: typeof quillInstance.getSelection === 'function',
            hasGetText: typeof quillInstance.getText === 'function',
            type: typeof quillInstance,
            keys: Object.keys(quillInstance || {}).slice(0, 10)
          });
        }
      } else {
        // Log what we found for debugging
        if (quillEditorElement) {
          console.log('[RichTextEditor] No __quill found, checking element:', {
            has__quill: !!quillEditorElement.__quill,
            parentHas__quill: !!quillEditorElement.parentElement?.__quill,
            className: quillEditorElement.className,
            parentClassName: quillEditorElement.parentElement?.className
          });
        }
      }
      
      // If not found, retry
      setTimeout(findQuillInstance, 100);
    };
    
    findQuillInstance();
    
    // Also try to find Quill instance when user interacts with editor
    const handleEditorInteraction = () => {
      if (!quillRef.current && containerRef.current) {
        const quillEditorElement = containerRef.current.querySelector('.ql-editor') as any;
        if (quillEditorElement) {
          let quillInstance = null;
          
          // Try multiple locations
          if (quillEditorElement.__quill) {
            quillInstance = quillEditorElement.__quill;
          } else if (quillEditorElement.parentElement?.__quill) {
            quillInstance = quillEditorElement.parentElement.__quill;
          } else {
            const quillContainer = containerRef.current.querySelector('.quill') as any;
            if (quillContainer?.__quill) {
              quillInstance = quillContainer.__quill;
            }
          }
          
          if (quillInstance && typeof quillInstance.getSelection === 'function') {
            quillRef.current = { getEditor: () => quillInstance };
            setEditorReady(true);
            console.log('[RichTextEditor] Quill instance found on user interaction');
          }
        }
      }
    };
    
    // Listen for focus/click events on the editor
    // Capture the element at the start to use in cleanup
    const editorElement = containerRef.current?.querySelector('.ql-editor');
    if (editorElement) {
      editorElement.addEventListener('focus', handleEditorInteraction, { once: true });
      editorElement.addEventListener('click', handleEditorInteraction, { once: true });
    }
    
    return () => {
      // Use the captured element from the effect start
      if (editorElement) {
        editorElement.removeEventListener('focus', handleEditorInteraction);
        editorElement.removeEventListener('click', handleEditorInteraction);
      }
    };
  }, [projectMembers]);

  // Handle keyboard navigation for mentions
  useEffect(() => {
    if (!quillRef.current || !showMentions || filteredMembers.length === 0) return;

    const quill = quillRef.current.getEditor();
    if (!quill) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev < filteredMembers.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredMembers[selectedMentionIndex]) {
          insertMention(filteredMembers[selectedMentionIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    };

    const editorElement = quill.root;
    editorElement.addEventListener('keydown', handleKeyDown);

    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMentions, filteredMembers, selectedMentionIndex, insertMention]);

  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [mentionQuery]);

  // Close mentions when clicking outside (but allow clicks on the menu)
  useEffect(() => {
    if (!showMentions) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Don't close if clicking on the mention menu
      const mentionMenu = document.querySelector('[data-mention-menu]');
      if (mentionMenu && mentionMenu.contains(target)) {
        return;
      }
      
      if (quillRef.current) {
        const quill = quillRef.current.getEditor();
        if (quill && !quill.container.contains(target)) {
          setShowMentions(false);
        }
      }
    };

    // Use a slight delay to allow menu clicks to register first
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [showMentions]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        '& .quill': {
          backgroundColor: theme.palette.background.paper,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          '&:hover': {
            borderColor: theme.palette.text.primary,
          },
          '&.ql-focused': {
            borderColor: theme.palette.text.primary,
          },
        },
        '& .ql-toolbar': {
          backgroundColor: theme.palette.background.paper,
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          borderBottom: `1px solid ${theme.palette.divider}`,
          '& .ql-stroke': {
            stroke: theme.palette.text.secondary,
          },
          '& .ql-fill': {
            fill: theme.palette.text.secondary,
          },
          '& .ql-picker-label': {
            color: theme.palette.text.secondary,
          },
          '& button:hover, & .ql-picker-label:hover': {
            color: theme.palette.text.primary,
            '& .ql-stroke': {
              stroke: theme.palette.text.primary,
            },
            '& .ql-fill': {
              fill: theme.palette.text.primary,
            },
          },
          '& button.ql-active': {
            color: theme.palette.text.primary,
            '& .ql-stroke': {
              stroke: theme.palette.text.primary,
            },
            '& .ql-fill': {
              fill: theme.palette.text.primary,
            },
          },
        },
        '& .ql-container': {
          backgroundColor: theme.palette.background.paper,
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
          fontFamily: 'inherit',
          fontSize: '0.875rem',
          '& .ql-editor': {
            color: theme.palette.text.primary,
            minHeight: '200px',
            '&::before': {
              color: theme.palette.text.secondary,
              fontStyle: 'normal',
            },
            '& p, & h1, & h2, & h3, & ul, & ol, & blockquote': {
              color: theme.palette.text.primary,
            },
            '& a': {
              color: theme.palette.text.primary,
            },
            '& code': {
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
              padding: '2px 4px',
              borderRadius: 2,
            },
            '& pre': {
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
              padding: '12px',
              borderRadius: 4,
            },
            '& blockquote': {
              borderLeft: `3px solid ${theme.palette.text.primary}`,
              paddingLeft: '12px',
              marginLeft: 0,
            },
          },
        },
      }}
    >
      <ReactQuill
        theme="snow"
        value={value}
        onChange={(content) => {
          onChange(content);
          // Trigger mention check after content changes
          setTimeout(() => {
            try {
              let quill: any = null;
              
              // Try multiple methods to find Quill instance
              // Method 1: From stored ref (if we've found it before)
              if (quillRef.current) {
                try {
                  quill = quillRef.current.getEditor();
                  if (quill && typeof quill.getSelection === 'function') {
                    // Valid instance, use it
                  } else {
                    quill = null;
                  }
                } catch (e) {
                  quill = null;
                }
              }
              
              // Method 2: Find from DOM using __quill property (ReactQuill attaches this)
              if (!quill && containerRef.current) {
                const quillEditorElement = containerRef.current.querySelector('.ql-editor') as any;
                if (quillEditorElement) {
                  // Try multiple locations for __quill
                  let quillInstance = null;
                  
                  // Try on the editor element itself
                  if (quillEditorElement.__quill) {
                    quillInstance = quillEditorElement.__quill;
                  }
                  
                  // Try on parent container
                  if (!quillInstance && quillEditorElement.parentElement) {
                    const parent = quillEditorElement.parentElement as any;
                    if (parent.__quill) {
                      quillInstance = parent.__quill;
                    }
                  }
                  
                  // Try on .quill container
                  if (!quillInstance) {
                    const quillContainer = containerRef.current.querySelector('.quill') as any;
                    if (quillContainer && quillContainer.__quill) {
                      quillInstance = quillContainer.__quill;
                    }
                  }
                  
                  if (quillInstance) {
                    // Verify it has the methods we need
                    if (typeof quillInstance.getSelection === 'function' && typeof quillInstance.getText === 'function') {
                      quill = quillInstance;
                      if (!quillRef.current) {
                        quillRef.current = { getEditor: () => quill as any };
                        setEditorReady(true);
                      }
                      console.log('[RichTextEditor] Found Quill via __quill property');
                    } else {
                      console.warn('[RichTextEditor] __quill exists but missing methods');
                    }
                  }
                }
              }
              
              if (quill) {
                // Check if it's actually a Quill instance
                if (typeof quill.getSelection !== 'function') {
                  console.error('[RichTextEditor] Quill instance is invalid:', quill);
                  // Try to get the actual Quill instance
                  if (quill.quill && typeof quill.quill.getSelection === 'function') {
                    quill = quill.quill;
                  } else if (quill.getEditor && typeof quill.getEditor === 'function') {
                    quill = quill.getEditor();
                  } else {
                    console.error('[RichTextEditor] Cannot access Quill methods');
                    return;
                  }
                }
                
                const selection = quill.getSelection(true);
                if (selection) {
                  const text = quill.getText(0, selection.index);
                  const atIndex = text.lastIndexOf('@');
                  
                  console.log('[RichTextEditor] Checking for mention:', { 
                    text, 
                    atIndex, 
                    selectionIndex: selection.index,
                    projectMembersCount: projectMembers.length 
                  });
                  
                  if (atIndex !== -1) {
                    const textAfterAt = text.substring(atIndex + 1);
                    console.log('[RichTextEditor] Text after @:', textAfterAt);
                    
                    if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
                      const query = textAfterAt.trim();
                      setMentionQuery(query);
                      
                      console.log('[RichTextEditor] Mention detected:', { query, projectMembersCount: projectMembers.length });
                      
                      if (projectMembers.length > 0) {
                        console.log('[RichTextEditor] Setting showMentions to TRUE');
                        setShowMentions(true);
                        const bounds = quill.getBounds(selection.index, true);
                        if (bounds) {
                          const editorElement = quill.root;
                          const editorRect = editorElement.getBoundingClientRect();
                          
                          const position = {
                            top: editorRect.top + bounds.top + bounds.height + 5,
                            left: editorRect.left + bounds.left,
                          };
                          
                          console.log('[RichTextEditor] Setting mention position:', position);
                          setMentionPosition(position);
                        } else {
                          console.warn('[RichTextEditor] Could not get bounds');
                        }
                      } else {
                        console.log('[RichTextEditor] No project members, hiding mentions');
                        setShowMentions(false);
                      }
                    } else {
                      console.log('[RichTextEditor] Space or newline found after @, hiding mentions');
                      setShowMentions(false);
                    }
                  } else {
                    console.log('[RichTextEditor] No @ found, hiding mentions');
                    setShowMentions(false);
                  }
                } else {
                  console.log('[RichTextEditor] No selection, hiding mentions');
                  setShowMentions(false);
                }
              } else {
                console.log('[RichTextEditor] No quill instance found - trying again in 100ms');
                // Retry after a longer delay - try multiple locations for __quill
                setTimeout(() => {
                  const quillEditorElement = containerRef.current?.querySelector('.ql-editor') as any;
                  if (quillEditorElement) {
                    let quillInstance = null;
                    
                    // Try multiple locations
                    if (quillEditorElement.__quill) {
                      quillInstance = quillEditorElement.__quill;
                    } else if (quillEditorElement.parentElement?.__quill) {
                      quillInstance = quillEditorElement.parentElement.__quill;
                    } else {
                      const quillContainer = containerRef.current?.querySelector('.quill') as any;
                      if (quillContainer?.__quill) {
                        quillInstance = quillContainer.__quill;
                      }
                    }
                    
                    if (quillInstance && typeof quillInstance.getSelection === 'function') {
                      quillRef.current = { getEditor: () => quillInstance };
                      setEditorReady(true);
                      console.log('[RichTextEditor] Quill instance found on retry');
                    } else {
                      console.log('[RichTextEditor] Still no valid Quill instance found, element:', quillEditorElement);
                    }
                  }
                }, 100);
              }
            } catch (error) {
              console.error('[RichTextEditor] Error in onChange:', error);
              setShowMentions(false);
            }
          }, 50);
        }}
        modules={modules}
        placeholder={placeholder || 'Add notes...'}
      />

      {/* Mention Menu - Rendered via Portal */}
      {showMentions && filteredMembers.length > 0 && menuPortalContainer && createPortal(
        <Paper
          data-mention-menu
          sx={{
            position: 'fixed',
            top: `${mentionPosition.top}px`,
            left: `${mentionPosition.left}px`,
            zIndex: 99999,
            maxHeight: 200,
            overflow: 'auto',
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            minWidth: 250,
            display: 'block',
            visibility: 'visible',
            opacity: 1,
          }}
        >
          <MenuList dense>
            {filteredMembers.map((member, index) => (
              <MenuItem
                key={member.id}
                selected={index === selectedMentionIndex}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  insertMention(member);
                }}
                sx={{
                  backgroundColor: index === selectedMentionIndex ? theme.palette.action.hover : 'transparent',
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                  cursor: 'pointer',
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    src={member.avatar_url || undefined}
                    sx={{ 
                      width: 32, 
                      height: 32, 
                      fontSize: '0.875rem',
                      backgroundColor: theme.palette.text.primary,
                      color: theme.palette.background.default,
                    }}
                  >
                    {(member.name || member.email || 'U').substring(0, 2).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                      {member.name || member.email}
                    </Typography>
                  }
                  secondary={
                    member.name && (
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                        {member.email}
                      </Typography>
                    )
                  }
                />
              </MenuItem>
            ))}
          </MenuList>
        </Paper>,
        menuPortalContainer
      )}
    </Box>
  );
}

