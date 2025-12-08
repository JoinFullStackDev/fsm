'use client';

import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Box, Paper, MenuList, MenuItem, Avatar, Typography, ListItemAvatar, ListItemText } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { User } from '@/types/project';

// Quill types - using 'any' for third-party library integration
// This is acceptable as Quill doesn't have great TypeScript support
// and the library has complex internal types

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
  const reactQuillRef = useRef<any>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [editorReady, setEditorReady] = useState(false);

  // Debug: log when projectMembers changes (only in development)
  useEffect(() => {
    // Project members tracking removed
  }, [projectMembers]);

  const modules = useMemo(
    () => {
      const mods: any = {
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
      };
      
      // Add text-change handler to get Quill instance
      // This will be set up in useEffect after ReactQuill mounts
      return mods;
    },
    []
  );

  // Filter project members based on mention query
  const filteredMembers = useMemo(() => {
    if (!projectMembers || projectMembers.length === 0) {
      console.log('[RichTextEditor] No project members available for mentions');
      return [];
    }
    if (!mentionQuery) {
      console.log('[RichTextEditor] Showing all project members:', projectMembers.length);
      return projectMembers;
    }
    const query = mentionQuery.toLowerCase();
    const filtered = projectMembers.filter(
      (member) =>
        member.name?.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query)
    );
    console.log('[RichTextEditor] Filtered members for query:', mentionQuery, filtered.length);
    return filtered;
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
    // Mention menu state tracking removed
  }, [showMentions, filteredMembers.length, mentionQuery, mentionPosition, menuPortalContainer, filteredMembers]);

  // Get Quill instance helper - tries multiple methods
  const getQuillInstance = useCallback((): any => {
    // Method 1: From stored ref (most reliable)
    if (quillRef.current) {
      try {
        const instance = quillRef.current.getEditor();
        if (instance && typeof instance.getSelection === 'function') {
          return instance;
        }
      } catch (e) {
        // Continue to next method
      }
    }
    
    // Method 2: From DOM - try editor element first
    if (containerRef.current) {
      const editorElement = containerRef.current.querySelector('.ql-editor') as any;
      if (editorElement) {
        // Try direct access
        let instance = editorElement.__quill;
        
        // Try parent
        if (!instance && editorElement.parentElement) {
          instance = editorElement.parentElement.__quill;
        }
        
        // Try quill container
        if (!instance) {
          const quillContainer = containerRef.current.querySelector('.quill') as any;
          if (quillContainer) {
            instance = quillContainer.__quill;
          }
        }
        
        if (instance && typeof instance.getSelection === 'function') {
          quillRef.current = { getEditor: () => instance };
          return instance;
        }
      }
    }
    
    // Method 3: From ReactQuill ref (if we have it)
    if (reactQuillRef.current) {
      try {
        const ref = reactQuillRef.current as any;
        // Try getEditor method
        if (typeof ref.getEditor === 'function') {
          const editor = ref.getEditor();
          if (editor && typeof editor.getSelection === 'function') {
            quillRef.current = { getEditor: () => editor };
            return editor;
          }
        }
        // Try internal properties
        if (ref.editingArea?.__quill) {
          const editor = ref.editingArea.__quill;
          if (editor && typeof editor.getSelection === 'function') {
            quillRef.current = { getEditor: () => editor };
            return editor;
          }
        }
        if (ref.quill && typeof ref.quill.getSelection === 'function') {
          quillRef.current = { getEditor: () => ref.quill };
          return ref.quill;
        }
      } catch (e) {
        // Continue
      }
    }
    
    return null;
  }, []);

  const insertMention = useCallback((member: User) => {
    const mentionText = `@${member.name || member.email} `;
    
    // Try to use Quill instance if available
    const quill = getQuillInstance();
    if (quill) {
      try {
        const selection = quill.getSelection(true);
        if (selection) {
          // Get all text up to cursor position
          const text = quill.getText(0, selection.index);
          const atIndex = text.lastIndexOf('@');

          if (atIndex !== -1) {
            // Calculate the start position (where @ is)
            const startPos = atIndex;
            const endPos = selection.index;

            // Delete the @ and query text
            quill.deleteText(startPos, endPos - startPos);

            // Insert the mention
            quill.insertText(startPos, mentionText);

            // Move cursor after the mention
            quill.setSelection(startPos + mentionText.length);

            setShowMentions(false);
            setMentionQuery('');

            if (onMentionSelect) {
              onMentionSelect(member.id, member.name || member.email);
            }
            return;
          }
        }
      } catch (error) {
        // Fall back to DOM manipulation
      }
    }

    // Fallback: Use DOM manipulation directly
    const editorElement = containerRef.current?.querySelector('.ql-editor') as HTMLElement;
    if (editorElement) {
      try {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          
          // Get text content up to cursor
          const preCaretRange = range.cloneRange();
          preCaretRange.selectNodeContents(editorElement);
          preCaretRange.setEnd(range.endContainer, range.endOffset);
          const textUpToCursor = preCaretRange.toString();
          const atIndex = textUpToCursor.lastIndexOf('@');
          
          if (atIndex !== -1) {
            // Find the @ symbol in the DOM
            let textNode: Node | null = null;
            let offset = 0;
            let found = false;
            
            const walker = document.createTreeWalker(
              editorElement,
              NodeFilter.SHOW_TEXT,
              null
            );
            
            let currentPos = 0;
            let node;
            while (node = walker.nextNode()) {
              const nodeText = node.textContent || '';
              const nodeLength = nodeText.length;
              
              if (currentPos + nodeLength >= atIndex && !found) {
                textNode = node;
                offset = atIndex - currentPos;
                found = true;
                
                // Now find where the query ends
                const textAfterAt = nodeText.substring(offset);
                let queryEnd = textAfterAt.search(/[\s\n]/);
                if (queryEnd === -1) {
                  queryEnd = textAfterAt.length;
                }
                
                // Create a range to delete @query
                const deleteRange = document.createRange();
                deleteRange.setStart(node, offset);
                
                // Find end position (might span multiple nodes)
                let endNode: Node = node;
                let endOffset = offset + queryEnd;
                if (endOffset > nodeText.length) {
                  // Query spans to next node
                  const nextNode = walker.nextNode();
                  if (nextNode) {
                    endNode = nextNode;
                    endOffset = endOffset - nodeText.length;
                  } else {
                    endOffset = nodeText.length;
                    endNode = node;
                  }
                }
                deleteRange.setEnd(endNode, endOffset);
                
                // Delete the @query
                deleteRange.deleteContents();
                
                // Insert the mention text
                const mentionTextNode = document.createTextNode(mentionText);
                deleteRange.insertNode(mentionTextNode);
                
                // Set cursor after mention
                const newRange = document.createRange();
                newRange.setStartAfter(mentionTextNode);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                
                // Trigger events so ReactQuill updates
                const inputEvent = new Event('input', { bubbles: true });
                editorElement.dispatchEvent(inputEvent);
                
                // Also trigger text-change for Quill
                const textChangeEvent = new Event('text-change', { bubbles: true });
                editorElement.dispatchEvent(textChangeEvent);
                
                // Update the value prop to keep ReactQuill in sync
                // Use setTimeout to ensure DOM is updated first
                setTimeout(() => {
                  const newContent = editorElement.innerHTML;
                  onChange(newContent);
                }, 0);
                
                setShowMentions(false);
                setMentionQuery('');

                if (onMentionSelect) {
                  onMentionSelect(member.id, member.name || member.email);
                }
                return;
              }
              
              currentPos += nodeLength;
            }
          }
        }
        } catch (error) {
          // Error in DOM-based mention insertion
        }
    }
    
    // Last resort: Simple text replacement in value
    const currentText = value.replace(/<[^>]*>/g, ''); // Strip HTML
    const atIndex = currentText.lastIndexOf('@');
    if (atIndex !== -1) {
      const textAfterAt = currentText.substring(atIndex + 1);
      let queryEnd = textAfterAt.search(/[\s\n]/);
      if (queryEnd === -1) {
        queryEnd = textAfterAt.length;
      }
      
      // Replace in HTML value
      let newContent = value || '';
      const lastAtIndex = newContent.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        let htmlQueryEnd = lastAtIndex + 1;
        while (htmlQueryEnd < newContent.length) {
          const char = newContent[htmlQueryEnd];
          if (char === ' ' || char === '\n' || char === '<') {
            break;
          }
          htmlQueryEnd++;
        }
        
        newContent = newContent.substring(0, lastAtIndex) + 
                    mentionText + 
                    newContent.substring(htmlQueryEnd);
        
        onChange(newContent);
        
        setShowMentions(false);
        setMentionQuery('');

        if (onMentionSelect) {
          onMentionSelect(member.id, member.name || member.email);
        }
      }
    }
  }, [onMentionSelect, getQuillInstance, value, onChange]);
  
  // Watch for ReactQuill to mount and set up refs using MutationObserver
  useEffect(() => {
    if (!containerRef.current) return;
    
    const findQuillInstance = (): any => {
      if (!containerRef.current) return null;
      
      const editorElement = containerRef.current.querySelector('.ql-editor') as any;
      if (!editorElement) return null;
      
      // Try all possible ways to access Quill instance
      let quillInstance: any = null;
      
      // Method 1: Direct from editor element
      quillInstance = editorElement.__quill;
      
      // Method 2: From parent (ql-container)
      if (!quillInstance && editorElement.parentElement) {
        quillInstance = (editorElement.parentElement as any).__quill;
      }
      
      // Method 3: From quill container
      const quillContainer = containerRef.current.querySelector('.quill') as any;
      if (!quillInstance && quillContainer) {
        quillInstance = quillContainer.__quill;
        
        // Also try accessing through ReactQuill's internal refs
        if (!quillInstance && (quillContainer as any).__reactInternalInstance) {
          // Try to find through React fiber
          let fiber = (quillContainer as any).__reactInternalInstance;
          while (fiber) {
            if (fiber.memoizedState?.quill || fiber.memoizedProps?.quill) {
              quillInstance = fiber.memoizedState?.quill || fiber.memoizedProps?.quill;
              break;
            }
            fiber = fiber.return;
          }
        }
      }
      
      // Method 4: Try using global Quill to find instances
      if (!quillInstance && typeof window !== 'undefined' && (window as any).Quill) {
        // Quill stores instances - try to find ours
        const allInstances = (window as any).Quill.instances || [];
        if (allInstances.length > 0) {
          // Find the instance that matches our editor element
          quillInstance = allInstances.find((inst: any) => 
            inst.root === editorElement || 
            inst.container?.contains(editorElement)
          );
        }
      }
      
      // Method 5: Try accessing through data attributes or other properties
      if (!quillInstance && editorElement) {
        // Some versions store it differently
        const possiblePaths = [
          editorElement.__quill,
          (editorElement as any).quill,
          editorElement.parentElement?.__quill,
          (editorElement.parentElement as any)?.quill,
        ];
        
        for (const path of possiblePaths) {
          if (path && typeof path.getSelection === 'function') {
            quillInstance = path;
            break;
          }
        }
      }
      
      return quillInstance;
    };
    
    const checkAndSetup = () => {
      const quillInstance = findQuillInstance();
      if (quillInstance && typeof quillInstance.getSelection === 'function') {
        const quillContainer = containerRef.current?.querySelector('.quill') as any;
        if (quillContainer) {
          reactQuillRef.current = quillContainer;
        }
        quillRef.current = { getEditor: () => quillInstance };
        setEditorReady(true);
        return true;
      }
      return false;
    };
    
    // Check immediately
    if (checkAndSetup()) return;
    
    // Use MutationObserver to watch for when the editor is added to DOM
    const observer = new MutationObserver(() => {
      if (checkAndSetup()) {
        observer.disconnect();
      }
    });
    
    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      attributes: false,
    });
    
    // Also check periodically as fallback
    let attempts = 0;
    const maxAttempts = 100; // 10 seconds
    const intervalId = setInterval(() => {
      attempts++;
      if (checkAndSetup() || attempts >= maxAttempts) {
        clearInterval(intervalId);
        observer.disconnect();
        if (attempts >= maxAttempts && !editorReady) {
          // Still try to set up with onChange fallback
          setEditorReady(true); // Allow onChange fallback to work
        }
      }
    }, 100);
    
    return () => {
      observer.disconnect();
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - editorReady is set inside this effect, so we don't want it in deps

  // Set up text-change handler when ReactQuill is ready
  useEffect(() => {
    if (!editorReady || !quillRef.current) return;
    
    let quillInstance: any = null;
    let textChangeHandler: ((delta: any, oldDelta: any, source: string) => void) | null = null;
    
    const setupHandler = () => {
      if (textChangeHandler) return; // Already set up
      
      const quill = getQuillInstance();
      if (quill) {
        quillInstance = quill;
        
        // Set up text-change handler for mention detection
        textChangeHandler = (delta: any, oldDelta: any, source: string) => {
          if (source === 'user') {
            try {
              const selection = quill.getSelection(true);
              if (selection) {
                const text = quill.getText(0, selection.index);
                const atIndex = text.lastIndexOf('@');
                
                if (atIndex !== -1) {
                  const textAfterAt = text.substring(atIndex + 1);
                  
                  if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
                    const query = textAfterAt.trim();
                    setMentionQuery(query);
                    
                    if (projectMembers && projectMembers.length > 0) {
                      setShowMentions(true);
                      
                      const bounds = quill.getBounds(selection.index, true);
                      if (bounds) {
                        const editorElement = quill.root;
                        const editorRect = editorElement.getBoundingClientRect();
                        
                        setMentionPosition({
                          top: editorRect.top + bounds.top + bounds.height + 5,
                          left: editorRect.left + bounds.left,
                        });
                      } else {
                        const editorElement = quill.root;
                        const editorRect = editorElement.getBoundingClientRect();
                        setMentionPosition({
                          top: editorRect.top + 50,
                          left: editorRect.left + 10,
                        });
                      }
                    } else {
                      setShowMentions(false);
                    }
                  } else {
                    setShowMentions(false);
                  }
                } else {
                  setShowMentions(false);
                }
              }
            } catch (error) {
              setShowMentions(false);
            }
          }
        };
        
        quill.on('text-change', textChangeHandler);
      }
    };
    
    // Try to set up immediately
    setupHandler();
    
    // Also try when user interacts with editor (focus/click)
    const editorElement = containerRef.current?.querySelector('.ql-editor');
    const interactionHandler = () => {
      setupHandler();
    };
    
    if (editorElement) {
      editorElement.addEventListener('focus', interactionHandler);
      editorElement.addEventListener('click', interactionHandler);
    }
    
    return () => {
      if (quillInstance && textChangeHandler) {
        try {
          quillInstance.off('text-change', textChangeHandler);
        } catch (e) {
          // Error removing handler - component may be unmounting
        }
      }
      if (editorElement) {
        editorElement.removeEventListener('focus', interactionHandler);
        editorElement.removeEventListener('click', interactionHandler);
      }
    };
  }, [editorReady, getQuillInstance, projectMembers]);

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
      <div
        onFocus={(e) => {
          // When editor is focused, try to find Quill instance
          if (!editorReady && containerRef.current) {
            const editorElement = containerRef.current.querySelector('.ql-editor') as any;
            if (editorElement) {
              // Try to find Quill instance one more time when focused
              let quillInstance = editorElement.__quill;
              if (!quillInstance && editorElement.parentElement) {
                quillInstance = (editorElement.parentElement as any).__quill;
              }
              if (!quillInstance) {
                const quillContainer = containerRef.current.querySelector('.quill') as any;
                if (quillContainer) {
                  quillInstance = quillContainer.__quill;
                }
              }
              
              if (quillInstance && typeof quillInstance.getSelection === 'function') {
                const quillContainer = containerRef.current.querySelector('.quill') as any;
                if (quillContainer) {
                  reactQuillRef.current = quillContainer;
                }
                quillRef.current = { getEditor: () => quillInstance };
                setEditorReady(true);
              }
            }
          }
        }}
      >
        <ReactQuill
          theme="snow"
          value={value}
          onChange={(content) => {
          onChange(content);
          
          // Primary mention detection: Check for @ mentions
          // Use setTimeout to allow Quill to update, then check
          setTimeout(() => {
            if (projectMembers && projectMembers.length > 0 && containerRef.current) {
              try {
                const editorElement = containerRef.current.querySelector('.ql-editor') as HTMLElement;
                if (!editorElement) return;
                
                // Try to get Quill instance - this might work now that editor is focused
                const quill = getQuillInstance();
                let text = '';
                let cursorPos = 0;
                let bounds: any = null;
                
                if (quill) {
                  try {
                    const selection = quill.getSelection(true);
                    if (selection) {
                      cursorPos = selection.index;
                      text = quill.getText(0, cursorPos);
                      bounds = quill.getBounds(selection.index, true);
                    }
                  } catch (e) {
                    // Fallback: use DOM selection
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                      const range = selection.getRangeAt(0);
                      if (editorElement.contains(range.commonAncestorContainer)) {
                        const preCaretRange = range.cloneRange();
                        preCaretRange.selectNodeContents(editorElement);
                        preCaretRange.setEnd(range.endContainer, range.endOffset);
                        text = preCaretRange.toString();
                        cursorPos = text.length;
                      }
                    }
                  }
                } else {
                  // Fallback: use DOM to get text and selection
                  const selection = window.getSelection();
                  if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    if (editorElement.contains(range.commonAncestorContainer)) {
                      const preCaretRange = range.cloneRange();
                      preCaretRange.selectNodeContents(editorElement);
                      preCaretRange.setEnd(range.endContainer, range.endOffset);
                      text = preCaretRange.toString();
                      cursorPos = text.length;
                    }
                  }
                  
                  // If we still don't have text, get all text from editor
                  if (!text) {
                    text = editorElement.textContent || '';
                    cursorPos = text.length;
                  }
                }
                
                // Check for @ mention
                const atIndex = text.lastIndexOf('@');
                if (atIndex !== -1) {
                  const textAfterAt = text.substring(atIndex + 1);
                  
                  if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
                    const query = textAfterAt.trim();
                    setMentionQuery(query);
                    setShowMentions(true);
                    
                    // Set position
                    if (bounds && quill) {
                      try {
                        const editorRect = editorElement.getBoundingClientRect();
                        setMentionPosition({
                          top: editorRect.top + bounds.top + bounds.height + 5,
                          left: editorRect.left + bounds.left,
                        });
                      } catch (e) {
                        const rect = editorElement.getBoundingClientRect();
                        setMentionPosition({
                          top: rect.top + 50,
                          left: rect.left + 10,
                        });
                      }
                    } else {
                      // Fallback position
                      const rect = editorElement.getBoundingClientRect();
                      setMentionPosition({
                        top: rect.top + 50,
                        left: rect.left + 10,
                      });
                    }
                  } else {
                    setShowMentions(false);
                  }
                } else {
                  setShowMentions(false);
                }
              } catch (error) {
                // Error in onChange mention detection
              }
            }
          }, 0);
        }}
          modules={modules}
          placeholder={placeholder || 'Add notes...'}
        />
      </div>

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

