// app/api/fragments/[fragmentId]/apply-theme/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/db";
import { Sandbox } from "@e2b/code-interpreter";

const THEMES = {
  default: {
    name: 'Default',
    replacements: [],
    cssVars: ''
  },
  neobrutalism: {
    name: 'Neobrutalism',
    replacements: [
      { from: /rounded-lg/g, to: 'rounded-none border-4 border-black' },
      { from: /rounded-md/g, to: 'rounded-none border-3 border-black' },
      { from: /rounded-xl/g, to: 'rounded-none border-4 border-black' },
      { from: /rounded-\w+/g, to: 'rounded-none' },
      { from: /shadow-sm/g, to: 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' },
      { from: /shadow-md/g, to: 'shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]' },
      { from: /shadow-lg/g, to: 'shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]' },
      { from: /shadow-xl/g, to: 'shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]' },
      { from: /bg-gradient-to-\w+/g, to: 'bg-white' },
    ],
    cssVars: `
      :root {
        --color-primary: #000000;
        --color-secondary: #FFFF00;
        --color-accent: #FF00FF;
      }
      body {
        background: #FFFFFF !important;
      }
    `
  },
  glassmorphism: {
    name: 'Glassmorphism',
    replacements: [
      { from: /bg-white(?!\s*\/)/g, to: 'bg-white/10 backdrop-blur-lg' },
      { from: /bg-gray-50/g, to: 'bg-white/5 backdrop-blur-md' },
      { from: /bg-gray-100/g, to: 'bg-white/10 backdrop-blur-md' },
      { from: /bg-gray-200/g, to: 'bg-white/15 backdrop-blur-md' },
    ],
    cssVars: `
      :root {
        --blur: 12px;
        --glass-bg: rgba(255, 255, 255, 0.1);
      }
      body {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      }
    `
  },
  claymorphism: {
    name: 'Claymorphism',
    replacements: [
      { from: /rounded-md/g, to: 'rounded-3xl' },
      { from: /rounded-lg/g, to: 'rounded-3xl' },
      { from: /rounded-xl/g, to: 'rounded-3xl' },
      { from: /shadow-sm/g, to: 'shadow-2xl' },
      { from: /shadow-md/g, to: 'shadow-2xl' },
      { from: /shadow-lg/g, to: 'shadow-2xl' },
    ],
    cssVars: `
      :root {
        --color-primary: #8B7CFF;
        --color-secondary: #FF6B9D;
        --color-accent: #FFC864;
        --shadow: 0 8px 32px rgba(139, 124, 255, 0.3);
      }
      body {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      }
    `
  }
} as const;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ fragmentId: string }> } // Changed this
) {
  try {
    const { theme } = await req.json();
    const { fragmentId } = await context.params; // Await params

    if (!theme || !THEMES[theme as keyof typeof THEMES]) {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
    }

    const fragment = await prisma.fragment.findUnique({
      where: { id: fragmentId },
      include: { message: true }
    });

    if (!fragment) {
      return NextResponse.json({ error: 'Fragment not found' }, { status: 404 });
    }

    const files = fragment.files as { [path: string]: string };
    const selectedTheme = THEMES[theme as keyof typeof THEMES];
    const updatedFiles: { [path: string]: string } = {};

    // Apply theme to all files
    for (const [path, content] of Object.entries(files)) {
      let updatedContent = content;

      // Apply replacements to HTML/JSX/TSX files
      if (path.endsWith('.html') || path.endsWith('.jsx') || path.endsWith('.tsx') || path.endsWith('.js')) {
        for (const { from, to } of selectedTheme.replacements) {
          updatedContent = updatedContent.replace(from, to);
        }

        // Inject CSS variables into HTML files
        if (path.endsWith('.html') && selectedTheme.cssVars) {
          const styleTag = `<style>${selectedTheme.cssVars}</style>`;
          
          if (updatedContent.includes('</head>')) {
            updatedContent = updatedContent.replace('</head>', `${styleTag}</head>`);
          } else if (updatedContent.includes('<head>')) {
            updatedContent = updatedContent.replace('<head>', `<head>${styleTag}`);
          } else {
            updatedContent = styleTag + updatedContent;
          }
        }
      }

      updatedFiles[path] = updatedContent;
    }

    // Update files in sandbox - FIX: Extract sandboxId correctly
    try {
      // sandboxUrl format: https://3000-ixb1ixxs9jdkkhyrz23w7.e2b.dev
      const sandboxId = fragment.sandboxUrl.split('//')[1].split('.')[0].split('-').slice(1).join('-');
      
      console.log('Connecting to sandbox:', sandboxId);
      
      // Try to reconnect instead of connect
      const sandbox = await Sandbox.connect(sandboxId);
      
      for (const [path, content] of Object.entries(updatedFiles)) {
        await sandbox.files.write(path, content);
      }
      
      console.log('Files updated in sandbox');
    } catch (sandboxError) {
      console.error('Sandbox error (continuing anyway):', sandboxError);
      // Continue even if sandbox update fails - at least DB will be updated
    }

    // Update database
    await prisma.fragment.update({
      where: { id: fragmentId },
      data: { files: updatedFiles }
    });

    return NextResponse.json({ 
      success: true,
      files: updatedFiles 
    });
  } catch (error) {
    console.error('Error applying theme:', error);
    return NextResponse.json({ 
      error: 'Failed to apply theme',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}