/**
 * Verify Package-to-Module Mapping
 * 
 * This script checks that all packages have proper module features configured
 * and that all modules are accessible through package features.
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { AVAILABLE_MODULES } from '@/lib/modules';
import type { PackageFeatures } from '@/lib/organizationContext';

interface Package {
  id: string;
  name: string;
  features: PackageFeatures | null;
  is_active: boolean;
}

async function verifyPackageModules() {
  const adminClient = createAdminSupabaseClient();
  
  console.log('🔍 Verifying Package-to-Module Mapping...\n');
  
  // Get all packages
  const { data: packages, error: packagesError } = await adminClient
    .from('packages')
    .select('id, name, features, is_active')
    .order('name');
  
  if (packagesError) {
    console.error('❌ Error fetching packages:', packagesError);
    return;
  }
  
  if (!packages || packages.length === 0) {
    console.warn('⚠️  No packages found in database');
    return;
  }
  
  console.log(`📦 Found ${packages.length} package(s)\n`);
  
  // Get all module keys
  const moduleKeys = AVAILABLE_MODULES.map(m => m.key);
  console.log(`🔧 Available modules: ${moduleKeys.join(', ')}\n`);
  
  // Check each package
  const issues: Array<{ package: string; issue: string }> = [];
  
  for (const pkg of packages as Package[]) {
    console.log(`\n📦 Package: ${pkg.name} (${pkg.is_active ? '✅ Active' : '❌ Inactive'})`);
    console.log(`   ID: ${pkg.id}`);
    
    if (!pkg.features) {
      issues.push({ package: pkg.name, issue: 'No features object' });
      console.log('   ⚠️  No features configured');
      continue;
    }
    
    const features = pkg.features as PackageFeatures;
    console.log('   Features:');
    
    // Check each module
    for (const moduleKey of moduleKeys) {
      const module = AVAILABLE_MODULES.find(m => m.key === moduleKey);
      const featureValue = (features as any)[moduleKey];
      
      if (featureValue === undefined) {
        issues.push({ 
          package: pkg.name, 
          issue: `Missing feature: ${moduleKey}` 
        });
        console.log(`      ❌ ${moduleKey}: undefined (should be boolean)`);
      } else if (typeof featureValue === 'boolean') {
        const status = featureValue ? '✅ Enabled' : '❌ Disabled';
        console.log(`      ${status} ${moduleKey}: ${featureValue}`);
      } else {
        issues.push({ 
          package: pkg.name, 
          issue: `Invalid type for ${moduleKey}: ${typeof featureValue} (should be boolean)` 
        });
        console.log(`      ⚠️  ${moduleKey}: ${featureValue} (${typeof featureValue}, should be boolean)`);
      }
    }
    
    // Check numeric limits
    console.log('   Limits:');
    console.log(`      max_projects: ${features.max_projects ?? 'null (unlimited)'}`);
    console.log(`      max_users: ${features.max_users ?? 'null (unlimited)'}`);
    console.log(`      max_templates: ${features.max_templates ?? 'null (unlimited)'}`);
    console.log(`      support_level: ${features.support_level}`);
  }
  
  // Summary
  console.log('\n\n📊 Summary:');
  if (issues.length === 0) {
    console.log('✅ All packages are properly configured!');
  } else {
    console.log(`⚠️  Found ${issues.length} issue(s):`);
    issues.forEach(({ package: pkgName, issue }) => {
      console.log(`   - ${pkgName}: ${issue}`);
    });
  }
  
  // Check organizations
  console.log('\n\n🏢 Checking Organizations:');
  const { data: organizations, error: orgsError } = await adminClient
    .from('organizations')
    .select('id, name, module_overrides')
    .limit(10);
  
  if (orgsError) {
    console.error('❌ Error fetching organizations:', orgsError);
  } else if (organizations) {
    console.log(`   Found ${organizations.length} organization(s) (showing first 10)`);
    for (const org of organizations) {
      const hasOverrides = org.module_overrides && 
        typeof org.module_overrides === 'object' && 
        Object.keys(org.module_overrides).length > 0;
      console.log(`   - ${org.name}: ${hasOverrides ? 'Has module overrides' : 'No overrides (using package defaults)'}`);
    }
  }
  
  // Check subscriptions
  console.log('\n\n💳 Checking Subscriptions:');
  const { data: subscriptions, error: subsError } = await adminClient
    .from('subscriptions')
    .select('id, organization_id, package_id, status')
    .limit(10);
  
  if (subsError) {
    console.error('❌ Error fetching subscriptions:', subsError);
  } else if (subscriptions) {
    console.log(`   Found ${subscriptions.length} subscription(s) (showing first 10)`);
    for (const sub of subscriptions) {
      const pkg = packages.find(p => p.id === sub.package_id);
      console.log(`   - Org: ${sub.organization_id}, Package: ${pkg?.name || sub.package_id}, Status: ${sub.status}`);
    }
  }
}

// Run if called directly
if (require.main === module) {
  verifyPackageModules()
    .then(() => {
      console.log('\n✅ Verification complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { verifyPackageModules };

