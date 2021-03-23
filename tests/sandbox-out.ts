import * as fc from 'fast-check';
/* eslint-disable @typescript-eslint/no-use-before-define,@typescript-eslint/no-unused-vars,no-prototype-builtins */
import {
    ABCType,
    Avatar,
    AvatarInput,
    FriendsLink,
    UpdateUserInput,
    User,
    ABCStatus,
    Friend,
    Status,
} from './types/generated';

type anABCTypeModel = {
    abc: fc.Arbitrary<ABCType['abc']>;
};
export const anABCType = (overrides?: Partial<anABCTypeModel>): fc.Arbitrary<ABCType> => {
    return fc.record({
        abc: overrides && overrides.hasOwnProperty('abc') ? overrides.abc! : fc.string(),
    });
};

type anAvatarModel = {
    id: fc.Arbitrary<Avatar['id']>;
    url: fc.Arbitrary<Avatar['url']>;
};
export const anAvatar = (overrides?: Partial<anAvatarModel>): fc.Arbitrary<Avatar> => {
    return fc.record({
        id: overrides && overrides.hasOwnProperty('id') ? overrides.id! : fc.uuid(),
        url: overrides && overrides.hasOwnProperty('url') ? overrides.url! : fc.string(),
    });
};

type anAvatarInputModel = {
    url: fc.Arbitrary<AvatarInput['url']>;
};
export const anAvatarInput = (overrides?: Partial<anAvatarInputModel>): fc.Arbitrary<AvatarInput> => {
    return fc.record({
        url: overrides && overrides.hasOwnProperty('url') ? overrides.url! : fc.string(),
    });
};

type aFriendsLinkModel = {
    id: fc.Arbitrary<FriendsLink['id']>;
    friends: fc.Arbitrary<FriendsLink['friends']>;
};
export const aFriendsLink = (overrides?: Partial<aFriendsLinkModel>): fc.Arbitrary<FriendsLink> => {
    return fc.record({
        id: overrides && overrides.hasOwnProperty('id') ? overrides.id! : fc.uuid(),
        friends:
            overrides && overrides.hasOwnProperty('friends')
                ? overrides.friends!
                : fc.option(fc.array(fc.oneof(anAvatar(), aUser()))),
    });
};

type anUpdateUserInputModel = {
    id: fc.Arbitrary<UpdateUserInput['id']>;
    login: fc.Arbitrary<UpdateUserInput['login']>;
    avatar: fc.Arbitrary<UpdateUserInput['avatar']>;
};
export const anUpdateUserInput = (overrides?: Partial<anUpdateUserInputModel>): fc.Arbitrary<UpdateUserInput> => {
    return fc.record({
        id: overrides && overrides.hasOwnProperty('id') ? overrides.id! : fc.uuid(),
        login: overrides && overrides.hasOwnProperty('login') ? overrides.login! : fc.option(fc.string()),
        avatar: overrides && overrides.hasOwnProperty('avatar') ? overrides.avatar! : fc.option(anAvatarInput()),
    });
};

type aUserModel = {
    id: fc.Arbitrary<User['id']>;
    creationDate: fc.Arbitrary<User['creationDate']>;
    login: fc.Arbitrary<User['login']>;
    avatar: fc.Arbitrary<User['avatar']>;
    status: fc.Arbitrary<User['status']>;
    customStatus: fc.Arbitrary<User['customStatus']>;
    scalarValue: fc.Arbitrary<User['scalarValue']>;
};
export const aUser = (overrides?: Partial<aUserModel>): fc.Arbitrary<User> => {
    return fc.memo((n) =>
        fc.record({
            id: overrides && overrides.hasOwnProperty('id') ? overrides.id! : fc.uuid(),
            creationDate:
                overrides && overrides.hasOwnProperty('creationDate')
                    ? overrides.creationDate!
                    : fc.date().map((d) => d.toISOString()),
            login: overrides && overrides.hasOwnProperty('login') ? overrides.login! : fc.string(),
            avatar: overrides && overrides.hasOwnProperty('avatar') ? overrides.avatar! : fc.option(anAvatar()),
            status:
                overrides && overrides.hasOwnProperty('status')
                    ? overrides.status!
                    : fc.constantFrom(Status.ONLINE, Status.OFFLINE),
            customStatus:
                overrides && overrides.hasOwnProperty('customStatus')
                    ? overrides.customStatus!
                    : fc.option(fc.constantFrom(ABCStatus.hasXYZStatus)),
            scalarValue:
                overrides && overrides.hasOwnProperty('scalarValue') ? overrides.scalarValue! : fc.asciiString(),
        }),
    )();
};

// console.dir(fc.sample(aFriendsLink()), { depth: null });

const foo = fc.letrec((tie) => ({
    User: fc.record({
        id: fc.uuid(),
        creationDate: fc.date().map((d) => d.toISOString()),
        login: fc.string(),
        avatar: fc.option(anAvatar()),
        status: fc.constantFrom(Status.ONLINE, Status.OFFLINE),
        customStatus: fc.option(fc.constantFrom(ABCStatus.hasXYZStatus)),
        scalarValue: fc.asciiString(),
        friends: fc.option(tie('User')),
    }),
})).User;
// eslint-disable-next-line no-console
console.dir(fc.sample(foo), { depth: null });
