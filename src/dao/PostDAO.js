import dotenv from 'dotenv';
import mongoose, {Schema} from "mongoose";
import {PostDB} from '../PostDB.js';
import {Post} from "../models/Post.js";
import {UserDAO} from "./UserDAO.js";

dotenv.config();

export class PostDAO {

    Post;

    // constructor, initializes the model for each new instance of PostDAO
    constructor() {
        PostDB.open().then();
        const schema = new mongoose.Schema(Post.getModel());
        this.Post = mongoose.model('Post', schema, process.env.MG_COLLECTION);
    }

    // gets all the posts in the DB
    async getAll(sortId = 0, filterId = 0) {
        let sortOptions = [
            {date: -1, hour: -1},
            {date: 1, hour: 1},
            {likes: -1},
            {likes: 1}
        ];

        let filterOptions = {};
        if (filterId.toString() !== '0') {
            filterOptions = {createdBy: filterId};
        }

        const users = await new UserDAO().getAll();
        const posts = await this.Post.find(filterOptions).sort(sortOptions[sortId]).lean();

        posts.forEach(post => {
            const user = users.filter(u => u.id === post.createdBy);
            post.author = user ? user.map(({username, lastname, firstname, avatar, status}) => ({username, lastname, firstname, avatar, status}))[0] : null;

            post.comments.forEach((comment, index) => {
                if (typeof comment !== 'string' && Object.keys(comment).length > 0) {
                    const user = users.filter(u => u.id === comment.commentedBy);
                    comment.author = user ? user.map(({username, lastname, firstname, avatar, status}) => ({
                        username,
                        lastname,
                        firstname,
                        avatar,
                        status
                    }))[0] : null;
                }
            });
        });

        posts.forEach(post => {
            if (post.hasOwnProperty('Shared') && post.Shared > 0) {
                post.originalPost = posts.find(p => p._id === post.Shared);
            }
        });

        return posts;
    }

    // increments the likes counter of a post
    async addLike(postId) {
        return await this.Post.findOneAndUpdate({_id: postId}, {$inc : {'likes' : 1}}).exec();
    }

    // decrements the likes counter of a post
    async removeLike(postId) {
        return await this.Post.findOneAndUpdate({_id: postId}, {$inc : {'likes' : -1}}).exec();
    }

    // adds a new comment
    async addComment(postId, userId, text) {
        let toRtn = {
            acknowledged: false,
            comment: null
        };
        const post = await this.Post.findById(postId);
        if (post) {
            const today = new Date();
            const date = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
            const hour = ('0' + today.getHours()).slice(-2) + ':' + ('0' + today.getMinutes()).slice(-2);

            const comment = {
                text: text,
                commentedBy: userId,
                date: date,
                hour: hour
            }
            post.comments.push(comment);
            toRtn.comment = comment;

            const updateResult = await this.Post.updateOne({_id: postId}, post);
            toRtn.acknowledged = updateResult.acknowledged;
        }
        return toRtn;
    }

    // decrements the likes counter of a post
    async sharePost(postId, userId, body, url, title, tags) {
        const today = new Date();
        const date = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
        const hour = ('0' + today.getHours()).slice(-2) + ':' + ('0' + today.getMinutes()).slice(-2);
        const lastPost = await this.Post.findOne({_id: {$exists: true}}).sort({ _id: -1 }).limit(1);
        const newId = lastPost._id + 1;
        
        return await this.Post.create({
            _id: newId,
            date: date,
            hour: hour,
            body: body,
            createdBy: userId,
            images: {
                url: url,
                title: title,
            },
            likes: 0,
            hashtags: tags,
            comments: [],
            Shared: postId
        });
    }

}
