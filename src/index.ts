import { ASTKindToNode, NamedTypeNode, parse, printSchema, TypeNode, visit, VisitFn } from 'graphql';
import casual from 'casual';
import { PluginFunction } from '@graphql-codegen/plugin-helpers';
import { pascalCase } from 'pascal-case';
import { upperCase } from 'upper-case';
import { sentenceCase } from 'sentence-case';
import a from 'indefinite';

type NamingConvention = 'upper-case#upperCase' | 'pascal-case#pascalCase' | 'keep';

const createNameConverter = (convention: NamingConvention) => (value: string) => {
    switch (convention) {
        case 'upper-case#upperCase':
            return upperCase(value || '');
        case 'keep':
            return value;
        case 'pascal-case#pascalCase':
        // fallthrough
        default:
            // default to pascal case in case of unknown values
            return pascalCase(value || '');
    }
};

const toMockName = (typedName: string, casedName: string, prefix?: string) => {
    if (prefix) {
        return `${prefix}${casedName}`;
    }
    const firstWord = sentenceCase(typedName).split(' ')[0];
    return `${a(firstWord, { articleOnly: true })}${casedName}`;
};

const updateTextCase = (str: string, enumValuesConvention: NamingConvention) => {
    const convert = createNameConverter(enumValuesConvention);

    if (str.charAt(0) === '_') {
        return str.replace(
            /^(_*)(.*)/,
            (_match, underscorePrefix, typeName) => `${underscorePrefix}${convert(typeName)}`,
        );
    }

    return convert(str);
};

const hashedString = (value: string) => {
    let hash = 0;
    if (value.length === 0) {
        return hash;
    }
    for (let i = 0; i < value.length; i++) {
        const char = value.charCodeAt(i);
        // eslint-disable-next-line no-bitwise
        hash = (hash << 5) - hash + char;
        // eslint-disable-next-line no-bitwise
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
};

const getScalarDefinition = (value: ScalarDefinition | ScalarGeneratorName): ScalarDefinition => {
    if (typeof value === 'string') {
        return {
            generator: value,
            arguments: [],
        };
    }
    return value;
};

const getNamedType = (
    typeName: string,
    fieldName: string,
    types: TypeItem[],
    typenamesConvention: NamingConvention,
    enumValuesConvention: NamingConvention,
    terminateCircularRelationships: boolean,
    prefix?: string,
    namedType?: NamedTypeNode,
    customScalars?: ScalarMap,
): string | number | boolean => {
    if (!namedType) {
        return '';
    }

    casual.seed(hashedString(typeName + fieldName));
    const name = namedType.name.value;
    switch (name) {
        case 'String':
            return 'fc.string()';
        case 'Float':
            return 'fc.float()';
        case 'ID':
            return 'fc.uuid()';
        case 'Boolean':
            return 'fc.boolean()';
        case 'Int':
            return 'fc.integer()';
        default: {
            const foundType = types.find((enumType: TypeItem) => enumType.name === name);
            if (foundType) {
                switch (foundType.type) {
                    case 'enum': {
                        // It's an enum
                        const typenameConverter = createNameConverter(typenamesConvention);
                        const choices = foundType.values.map(
                            (v) => `${typenameConverter(foundType.name)}.${updateTextCase(v, enumValuesConvention)}`,
                        );
                        return `fc.constantFrom(${choices.join(',')})`;
                        // return `${typenameConverter(foundType.name)}.${updateTextCase(value, enumValuesConvention)}`;
                    }
                    case 'union': {
                        // fc.oneof over foundType.types.map(getNamedType)
                        const unionArbitraries = foundType.types.map((t) =>
                            getNamedType(
                                typeName,
                                fieldName,
                                types,
                                typenamesConvention,
                                enumValuesConvention,
                                terminateCircularRelationships,
                                prefix,
                                t,
                            ),
                        );
                        return `fc.oneof(${unionArbitraries.join(',')})`;
                    }

                    case 'scalar': {
                        const customScalar = customScalars ? getScalarDefinition(customScalars[foundType.name]) : null;
                        // it's a scalar, let's use a string as a value if there is no custom
                        // mapping for this particular scalar
                        if (!customScalar || !customScalar.generator) {
                            if (foundType.name === 'Date') {
                                return 'fc.date().map(d => d.toISOString())';
                            }
                            return 'fc.asciiString()';
                        }

                        // If there is a mapping to a `casual` type, then use it and make sure
                        // to call it if it's a function
                        const embeddedGenerator = casual[customScalar.generator];

                        if (!embeddedGenerator && customScalar.generator) {
                            return customScalar.generator;
                        }

                        const generatorArgs: unknown[] = Array.isArray(customScalar.arguments)
                            ? customScalar.arguments
                            : [customScalar.arguments];
                        const value =
                            typeof embeddedGenerator === 'function'
                                ? embeddedGenerator(...generatorArgs)
                                : embeddedGenerator;

                        if (typeof value === 'string') {
                            return `'${value}'`;
                        }
                        if (typeof value === 'object') {
                            return `${JSON.stringify(value)}`;
                        }
                        return value;
                    }
                    default:
                        throw `foundType is unknown: ${foundType.name}: ${foundType.type}`;
                }
            }
            if (terminateCircularRelationships) {
                return `relationshipsToOmit.has('${name}') ? {} as ${name} : ${toMockName(
                    name,
                    name,
                    prefix,
                )}({}, relationshipsToOmit)`;
            } else {
                return `${toMockName(name, name, prefix)}()`;
            }
        }
    }
};

const generateMockValue = (
    typeName: string,
    fieldName: string,
    types: TypeItem[],
    typenamesConvention: NamingConvention,
    enumValuesConvention: NamingConvention,
    terminateCircularRelationships: boolean,
    prefix: string | undefined,
    currentType: TypeNode,
    customScalars: ScalarMap,
): string | number | boolean => {
    switch (currentType.kind) {
        case 'NamedType':
            return getNamedType(
                typeName,
                fieldName,
                types,
                typenamesConvention,
                enumValuesConvention,
                terminateCircularRelationships,
                prefix,
                currentType as NamedTypeNode,
                customScalars,
            );
        case 'NonNullType':
            return generateMockValue(
                typeName,
                fieldName,
                types,
                typenamesConvention,
                enumValuesConvention,
                terminateCircularRelationships,
                prefix,
                currentType.type,
                customScalars,
            );
        case 'ListType': {
            const value = generateMockValue(
                typeName,
                fieldName,
                types,
                typenamesConvention,
                enumValuesConvention,
                terminateCircularRelationships,
                prefix,
                currentType.type,
                customScalars,
            );
            return `fc.array(${value})`;
        }
    }
};

const getMockString = (
    typeName: string,
    fields: string,
    overrideFields: string,
    typenamesConvention: NamingConvention,
    terminateCircularRelationships: boolean,
    addTypename = false,
    prefix,
    typesPrefix = '',
) => {
    const casedName = createNameConverter(typenamesConvention)(typeName);
    const typename = addTypename ? `\n        __typename: '${casedName}',` : '';
    const typenameReturnType = addTypename ? `{ __typename: '${casedName}' } & ` : '';
    const mockName = toMockName(typeName, casedName, prefix);
    const modelName = `${mockName}Model`;
    if (terminateCircularRelationships) {
        return `
type ${modelName} = {${typename}
${fields}
};
export const ${mockName} = (overrides?: Partial<${modelName}>, relationshipsToOmit: Set<string> = new Set()): fc.Arbitrary<${typenameReturnType}${typesPrefix}${casedName}> => {
    relationshipsToOmit.add('${casedName}');
    return fc.record({${typename}
${overrideFields}
    });
};`;
    } else {
        return `
type ${modelName} = {${typename}
${fields}
};
export const ${mockName} = (overrides?: Partial<${modelName}>): fc.Arbitrary<${typenameReturnType}${typesPrefix}${casedName}> => {
    return fc.record({${typename}
${overrideFields}
    });
};`;
    }
};

type ScalarGeneratorName = keyof Casual.Casual | keyof Casual.functions | string;
type ScalarDefinition = {
    generator: ScalarGeneratorName;
    arguments: unknown;
};

type ScalarMap = {
    [name: string]: ScalarGeneratorName | ScalarDefinition;
};

export interface TypescriptMocksPluginConfig {
    typesFile?: string;
    enumValues?: NamingConvention;
    typenames?: NamingConvention;
    addTypename?: boolean;
    prefix?: string;
    scalars?: ScalarMap;
    terminateCircularRelationships?: boolean;
    typesPrefix?: string;
}

interface TypeItem {
    name: string;
    type: 'enum' | 'scalar' | 'union';
    values?: string[];
    types?: readonly NamedTypeNode[];
}

type VisitorType = { [K in keyof ASTKindToNode]?: VisitFn<ASTKindToNode[keyof ASTKindToNode], ASTKindToNode[K]> };

// This plugin was generated with the help of ast explorer.
// https://astexplorer.net
// Paste your graphql schema in it, and you'll be able to see what the `astNode` will look like
export const plugin: PluginFunction<TypescriptMocksPluginConfig> = (schema, documents, config) => {
    const printedSchema = printSchema(schema); // Returns a string representation of the schema
    const astNode = parse(printedSchema); // Transforms the string into ASTNode

    const enumValuesConvention = config.enumValues || 'pascal-case#pascalCase';
    const typenamesConvention = config.typenames || 'pascal-case#pascalCase';
    // List of types that are enums
    const types: TypeItem[] = [];
    const visitor: VisitorType = {
        EnumTypeDefinition: (node) => {
            const name = node.name.value;
            if (!types.find((enumType: TypeItem) => enumType.name === name)) {
                types.push({
                    name,
                    type: 'enum',
                    values: node.values ? node.values.map((node) => node.name.value) : [],
                });
            }
        },
        UnionTypeDefinition: (node) => {
            const name = node.name.value;
            if (!types.find((enumType) => enumType.name === name)) {
                types.push({
                    name,
                    type: 'union',
                    types: node.types,
                });
            }
        },
        FieldDefinition: (node) => {
            const fieldName = node.name.value;

            return {
                name: fieldName,
                mockFn: (typeName: string) => {
                    let value = generateMockValue(
                        typeName,
                        fieldName,
                        types,
                        typenamesConvention,
                        enumValuesConvention,
                        !!config.terminateCircularRelationships,
                        config.prefix,
                        node.type,
                        config.scalars,
                    );
                    const nullable = node.type.kind !== 'NonNullType';
                    if (nullable) {
                        value = `fc.option(${value})`;
                    }
                    return {
                        field: `        ${fieldName}:  fc.Arbitrary<${typeName}['${fieldName}']>;`,
                        overrideField: `        ${fieldName}: overrides && overrides.hasOwnProperty('${fieldName}') ? overrides.${fieldName}! : ${value},`,
                    };
                    return `        ${fieldName}: overrides && overrides.hasOwnProperty('${fieldName}') ? overrides.${fieldName}! : ${value},`;
                },
            };
        },
        InputObjectTypeDefinition: (node) => {
            const fieldName = node.name.value;

            return {
                typeName: fieldName,
                mockFn: () => {
                    const mockFields = node.fields
                        ? node.fields.map((field) => {
                              let value = generateMockValue(
                                  fieldName,
                                  field.name.value,
                                  types,
                                  typenamesConvention,
                                  enumValuesConvention,
                                  !!config.terminateCircularRelationships,
                                  config.prefix,
                                  field.type,
                                  config.scalars,
                              );
                              const nullable = field.type.kind !== 'NonNullType';
                              if (nullable) {
                                  value = `fc.option(${value})`;
                              }
                              return {
                                  field: `        ${field.name.value}: fc.Arbitrary<${fieldName}['${field.name.value}']>;`,
                                  overrideField: `        ${field.name.value}: overrides && overrides.hasOwnProperty('${field.name.value}') ? overrides.${field.name.value}! : ${value},`,
                              };
                          })
                        : [];

                    return getMockString(
                        fieldName,
                        mockFields.map((f) => f.field).join('\n'),
                        mockFields.map((f) => f.overrideField).join('\n'),
                        typenamesConvention,
                        !!config.terminateCircularRelationships,
                        false,
                        config.prefix,
                        config.typesPrefix,
                    );
                },
            };
        },
        ObjectTypeDefinition: (node) => {
            // This function triggered per each type
            const typeName = node.name.value;

            if (typeName === 'Query' || typeName === 'Mutation') {
                return null;
            }

            const { fields } = node;
            return {
                typeName,
                mockFn: () => {
                    const mockFields = fields ? fields.map(({ mockFn }: any) => mockFn(typeName)) : [];

                    return getMockString(
                        typeName,
                        mockFields.map((f) => f.field).join('\n'),
                        mockFields.map((f) => f.overrideField).join('\n'),
                        typenamesConvention,
                        !!config.terminateCircularRelationships,
                        !!config.addTypename,
                        config.prefix,
                        config.typesPrefix,
                    );
                },
            };
        },
        ScalarTypeDefinition: (node) => {
            const name = node.name.value;
            if (!types.find((enumType) => enumType.name === name)) {
                types.push({
                    name,
                    type: 'scalar',
                });
            }
        },
    };

    const result: any = visit(astNode, { leave: visitor });
    const definitions = result.definitions.filter((definition: any) => !!definition);
    const typesFile = config.typesFile ? config.typesFile.replace(/\.[\w]+$/, '') : null;
    const typeImports = definitions
        .map(({ typeName }: { typeName: string }) => typeName)
        .filter((typeName: string) => !!typeName);
    typeImports.push(...types.filter(({ type }) => type !== 'scalar').map(({ name }) => name));
    // List of function that will generate the mock.
    // We generate it after having visited because we need to distinct types from enums
    const mockFns = definitions.map(({ mockFn }: any) => mockFn).filter((mockFn: Function) => !!mockFn);
    const fastCheckImport = `import * as fc from 'fast-check'\n`;
    const typesFileImport = typesFile
        ? `/* eslint-disable @typescript-eslint/no-use-before-define,@typescript-eslint/no-unused-vars,no-prototype-builtins */
import { ${typeImports.join(', ')} } from '${typesFile}';\n`
        : '';

    return `${fastCheckImport}${typesFileImport}${mockFns.map((mockFn: Function) => mockFn()).join('\n')}
`;
};
