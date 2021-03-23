import 'module-alias/register';

import { readFileSync } from 'fs';
import { buildSchema } from 'graphql';
import { plugin } from '../src';

const testSchema = buildSchema(/* GraphQL */ `
    scalar Date
    scalar AnyObject

    type Avatar {
        id: ID!
        url: String!
    }

    type User {
        id: ID!
        creationDate: Date!
        login: String!
        avatar: Avatar
        status: Status!
        customStatus: ABCStatus
        scalarValue: AnyObject!
    }

    type Query {
        user: User!
    }

    union Onion = Avatar | User

    type ABCType {
        abc: String!
    }

    input UpdateUserInput {
        id: ID!
        login: String
        avatar: Avatar
    }

    input Doink {
        shuz: Onion
    }

    enum Status {
        ONLINE
        OFFLINE
    }

    enum ABCStatus {
        hasXYZStatus
    }

    type Mutation {
        updateUser(user: UpdateUserInput): User
    }
`);

const schema = buildSchema(readFileSync('tests/graphql/schema.graphql').toString());

async function doShit() {
    const result = await plugin(schema, [], {
        typesFile: './types/generated.ts',
        typenames: 'keep',
        enumValues: 'keep',
        // terminateCircularRelationships: true,
    });
    // eslint-disable-next-line no-console
    console.log(result);
}

doShit();
