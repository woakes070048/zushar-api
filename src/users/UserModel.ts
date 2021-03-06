/**
 * created by waweru
*/

import * as _ from 'lodash';
import * as mongoose from 'mongoose';
import { logger as log } from '../logger';
import { userModel as db } from './UserSchema';

export interface updateNotify {
    done: boolean; 
    timestamp: Date;
};

export interface User extends UserProfile{
    jwt_token: string;
};

export interface UserProfile {
    name: string;
    email: string;
    phone: string;
    gender: string;
    dob?: string;
}

export interface AuthData {
    email: string;
    phone: string;
    password: string;
}

export class UserModel {
    /**
     * @docs:
     *     user module model for dealing with user related data and data manipulation plus storage
    */
    protected registerUser(user: UserProfile, password: string): Promise<User> {
        let { email, gender, phone, name, dob } = user;
        
        let formattedDob: Date;
        if (dob) {
            formattedDob = new Date(dob);
        }
        
        let newUser = new db({ email, gender, phone, name, formattedDob });
        newUser.password = db.setPassword(password);

        return newUser
            .save()
            .then((data) => {
               let new_user =  { user: data, jwt_token: data.generateJWT() };
               delete new_user.user.password; // remove user password
               return Promise.resolve(new_user);
            })
            .catch((err: Error) => {
                log.error(err);
                return Promise.reject(err);
            });
    }
    protected authenticateUser(params: AuthData): Promise<User> {
        let { email, phone, password } = params;
        return db
            .findOne({ email, phone })
            .exec()
            .then((data) => {
                // check if user exist
                if (!data) {
                    let date = new Date();
                    let err: Error = new Error(`${date}:: account not found`);
                    log.warn(err);
                    return Promise.reject(err);
                }
                return Promise.resolve(data);
            })
            .then((data) => {
                //#then check if password entered is valid
                if (!data.validatePassword(params.password)) {
                    let date = new Date();
                    let err: Error = new Error(`${date}:: password is incorrect`);
                    log.warn(err);
                    return Promise.reject(err);
                }
                return Promise.resolve(data);
            })
            .then((data) => {
                //# then check if user is marked as disabled
                if (data.deletion) {
                    let date = new Date();
                    let err: Error = new Error(`${date.toDateString()}:: user-account is disabled`);
                    log.warn(err);
                    return Promise.reject(err);;
                }
                return Promise.resolve(data);
            })
            .then((data) => {
                // #then return user
               let loggedInUser =  { user: data, jwt_token: data.generateJWT() };
               delete loggedInUser.user.password; // remove user password
               return Promise.resolve(loggedInUser);
            })
            .catch((err: Error) => {
                // otherwise return error if something goes wrong
                log.error(err);
                return Promise.reject(err);
            });
    }
    protected updateUser(id: string, params: AuthData, updates: any): Promise<updateNotify> {
        /**
         * @docs: 
         *     This method will be used to disable user accounts as well
        */
        let updatesCopy = _.assign({}, updates);
        let { email, phone, password } = params;
        let _id = <mongoose.Types.ObjectId>mongoose.Types.ObjectId(id);
        
        // authenticate user first
        return this.authenticateUser(params)
            .then((data) => {
                //#then hash the password if it is part of the updates to be done
                if (!_.isEmpty(updates.password)) {
                    updatesCopy = _.assign({}, updatesCopy, {
                        password: db.setPassword(updates.password)
                    });
                }
                return Promise.resolve(updatesCopy);
            })
            .then(() => {
                // #then run the update
                return db.update({ _id, email, phone }, { $set: updatesCopy },
                {  
                    safe: true,
                    multi: false,
                    runValidators: true
                }).exec();
            })
            .then((updated) => {
                if (updated.ok === 1 && updated.nModified === 1) {
                    return Promise.resolve({
                        done: true,
                        timestamp: new Date()
                    });
                }
                else {
                    return Promise.resolve({
                        done: false,
                        timestamp: new Date()
                    });
                }
            })
            .catch((err: Error) => {
                // otherwise return error if something goes wrong
                log.error(err);
                return Promise.reject(err);
            });
    }
    
    static getOneUser(id: string): Promise<UserProfile> {
        let _id = <mongoose.Types.ObjectId>mongoose.Types.ObjectId(id);
        return db
            .findById(_id)
            .select({ 'password': 0 })
            .exec()
            .then((data) => {
                return Promise.resolve(data);
            })
            .catch((err: Error) => {
                log.error(err);
                return Promise.reject(err);
            });
    }
}