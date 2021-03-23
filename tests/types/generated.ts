export type Maybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
    ID: string;
    String: string;
    Boolean: boolean;
    Int: number;
    Float: number;
    Date: any;
    AnyObject: any;
};

export enum ABCStatus {
    hasXYZStatus = 'hasXYZStatus',
}

export type ABCType = {
    __typename?: 'ABCType';
    abc: Scalars['String'];
};

export type Avatar = {
    __typename?: 'Avatar';
    id: Scalars['ID'];
    url: Scalars['String'];
};

export type AvatarInput = {
    url: Scalars['String'];
};

export type Friend = Avatar | User;

export type FriendsLink = {
    __typename?: 'FriendsLink';
    id: Scalars['ID'];
    friends: Maybe<Array<Friend>>;
};

export type Mutation = {
    __typename?: 'Mutation';
    updateUser: Maybe<User>;
};

export type MutationupdateUserArgs = {
    user: Maybe<UpdateUserInput>;
};

export type Query = {
    __typename?: 'Query';
    user: User;
};

export enum Status {
    ONLINE = 'ONLINE',
    OFFLINE = 'OFFLINE',
}

export type UpdateUserInput = {
    id: Scalars['ID'];
    login: Maybe<Scalars['String']>;
    avatar: Maybe<AvatarInput>;
};

export type User = {
    __typename?: 'User';
    id: Scalars['ID'];
    creationDate: Scalars['Date'];
    login: Scalars['String'];
    avatar: Maybe<Avatar>;
    status: Status;
    customStatus: Maybe<ABCStatus>;
    scalarValue: Scalars['AnyObject'];
};
