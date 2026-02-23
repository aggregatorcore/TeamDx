#!/usr/bin/env node
/**
 * Schema Selection Script
 * 
 * This script ensures the correct Prisma schema is active based on the target environment.
 * 
 * Usage:
 *   node scripts/select-schema.js [sqlite|postgres]
 * 
 * If no argument is provided, it defaults to sqlite for local development.
 */

const fs = require('fs');
const path = require('path');

const target = process.argv[2] || 'sqlite';
const prismaDir = path.join(__dirname, '..', 'prisma');
const schemaPath = path.join(prismaDir, 'schema.prisma');
const sqliteSchemaPath = path.join(prismaDir, 'schema.sqlite.prisma');
const postgresSchemaPath = path.join(prismaDir, 'schema.postgres.prisma');

function selectSchema(targetSchema) {
    let sourceSchemaPath;

    if (targetSchema === 'postgres' || targetSchema === 'postgresql') {
        sourceSchemaPath = postgresSchemaPath;
        console.log('✓ Selecting PostgreSQL schema for production/docker');
    } else if (targetSchema === 'sqlite') {
        sourceSchemaPath = sqliteSchemaPath;
        console.log('✓ Selecting SQLite schema for local development');
    } else {
        console.error(`❌ Unknown schema target: ${targetSchema}`);
        console.error('   Valid options: sqlite, postgres, postgresql');
        process.exit(1);
    }

    if (!fs.existsSync(sourceSchemaPath)) {
        console.error(`❌ Schema file not found: ${sourceSchemaPath}`);
        process.exit(1);
    }

    // Backup current schema if it exists and is different
    if (fs.existsSync(schemaPath)) {
        const currentContent = fs.readFileSync(schemaPath, 'utf8');
        const sourceContent = fs.readFileSync(sourceSchemaPath, 'utf8');

        // Only backup if different
        if (currentContent !== sourceContent) {
            const backupPath = `${schemaPath}.backup.${Date.now()}`;
            fs.copyFileSync(schemaPath, backupPath);
            console.log(`   Backed up current schema to: ${backupPath}`);
        }
    }

    // Copy the selected schema
    fs.copyFileSync(sourceSchemaPath, schemaPath);
    console.log(`✓ Schema selected: ${path.basename(sourceSchemaPath)} → schema.prisma`);
}

selectSchema(target);

