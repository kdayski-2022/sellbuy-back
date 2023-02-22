'use strict';
const session = require('../controllers/session.controller')
const empty = require('is-empty')
const db = require('../database/singleModel')('ManagerLog')
const errHandler = require('err-handler');
const async = require('async');
const paramRegx = /\/:([^\/]+)$/;
const identity = function (self) {
  return self;
};

module.exports = function (application, options) {
  options = options || {};

  var formatResponse = options.formatResponse || identity;

  application.crud = function (route, optionalWare, resource, roles) {
    roles = empty(roles) ? ['admin'] : roles
    var args = [].slice.call(arguments)
    route = args.shift();
    resource = args.pop();
    var middleware = args.filter(byMiddleware);
    var param = '/:id';
    var paramName = 'id';
    var paramMatch = paramRegx.exec(route);
    var search = '/search'

    if (typeof route !== 'string') throw new Error('route expected as string');
    if (!(resource instanceof Object)) throw new Error('expected resource Object');
    if (route[0] !== '/') route = '/' + route;
    if (paramMatch) {
      param = paramMatch[0];
      paramName = paramMatch[1];
      route = route.replace(paramRegx, '');
    }

    if (resource.create) {
      this.post.apply(
        this,
        [route]
          .concat(middleware)
          .concat([postHandler.bind(null, resource, roles)])
      );
    }

    if (resource.delete) {
      this.delete.apply(
        this,
        [route + param]
          .concat(middleware)
          .concat(deleteHandler.bind(null, resource, roles, paramName))
      );
    }

    if (resource.read) {
      this.get.apply(
        this,
        [route]
          .concat(middleware)
          .concat(getHandler.bind(null, resource, roles))
      );
    }

    if (resource.readById) {
      this.get.apply(
        this,
        [route + param]
          .concat(middleware)
          .concat(getByIdHandler.bind(null, resource, roles, paramName))
      );
    }
    if (resource.search) {
      this.get.apply(
        this,
        [route + search]
          .concat(middleware)
          .concat(getSearchHandler.bind(null, resource, roles, paramName))
      );
    }

    if (resource.update) {
      this.put.apply(
        this,
        [route + param]
          .concat(middleware)
          .concat(putHandler.bind(null, resource, roles, paramName))
      );
    }
  };

  async function deleteHandler(resource, roles, param, req, res, next) {

    const access = await accessMiddleware({ req, roles, actionType: 'delete' })
    if (access.statusCode !== 0) return res.status(access.statusCode).send()

    var ids = req.params[param].split(',');
    var query = req.query;

    var tasks = ids.map(function (id) {
      return resource.delete.bind(null, id, query);
    });

    if (tasks.length === 1) {
      return tasks[0](errHandler(next, function (resource) {
        if (resource) return res.status(200).json(formatResponse(resource));
        res.status(204).json(null);
      }));
    }

    async.parallel(tasks, errHandler(next, function (results) {
      res.status(200).json(formatResponse(results));
    }));
  }

  async function getHandler(resource, roles, req, res, next) {
    console.log('getHandler')
    const access = await accessMiddleware({ req, roles })
    if (access.statusCode !== 0) return res.status(access.statusCode).send()

    resource.read(req, (a, res2) => {
      const { count, rows } = res2
      res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count')
      res.setHeader("X-Total-Count", count);
      if (Array.isArray(rows)) res.status(200).json(rows);
      else res.status(204).json(null);
    })
  }

  async function getByIdHandler(resource, roles, param, req, res, next) {

    const access = await accessMiddleware({ req, roles })
    if (access.statusCode !== 0) return res.status(access.statusCode).send()

    var ids = req.params[param].split(',');
    var query = req.query;

    var tasks = ids.map(function (id) {
      return resource.readById.bind(null, id, query, req);
    });

    if (tasks.length === 1) {
      return tasks[0](errHandler(next, function (resource) {
        if (resource) res.status(200).json(formatResponse(resource));
        else res.status(204).json(null);
      }));
    }

    async.parallel(tasks, errHandler(next, function (result) {
      res.status(200).json(formatResponse(result));
    }));
  }
  async function getSearchHandler(resource, roles, param, req, res, next) {

    const access = await accessMiddleware({ req, roles })
    if (access.statusCode !== 0) return res.status(access.statusCode).send()

    var ids = req.params[param].split(',');
    var query = req.query;

    var tasks = ids.map(function (id) {
      return resource.readById.bind(null, id, query);
    });

    if (tasks.length === 1) {
      return tasks[0](errHandler(next, function (resource) {
        if (resource) res.status(200).json(formatResponse(resource));
        else res.status(204).json(null);
      }));
    }

    async.parallel(tasks, errHandler(next, function (result) {
      res.status(200).json(formatResponse(result));
    }));
  }
  async function postHandler(resource, roles, req, res, next) {

    const access = await accessMiddleware({ req, roles, actionType: 'create', actionData: req.body })
    if (access.statusCode !== 0) return res.status(access.statusCode).send()

    resource.create(req.query, req.body, errHandler(next, function (resource) {
      if (resource) res.status(200).json(formatResponse(resource));
      else res.status(204).json(null);
    }));
  }

  async function putHandler(resource, roles, param, req, res, next) {

    var id = req.params[param];
    var query = req.query;
    var body = req.body;

    const access = await accessMiddleware({ req, roles, actionType: 'update', actionData: body })
    if (access.statusCode !== 0) return res.status(access.statusCode).send()

    // await managerDocBlock.blocked({model:resource.name, req,id})

    resource.update(id, query, req, body, errHandler(next, function (resource) {
      if (resource) res.status(200).json(formatResponse(resource));
      else res.status(204).json(null);
    }));
  }

  function byMiddleware(proposed) {
    return typeof proposed === 'function' && proposed.length === 3;
  }
  function accessMiddleware(data) {
    console.log(data)
    const { req, roles, actionType, actionData = '' } = data
    return new Promise(async (resolve, reject) => {
      let result = { statusCode: 0 }
      const apiKey = (!empty(req.headers['Api-Key'.toLowerCase()])) ? req.headers['Api-Key'.toLowerCase()] : null
      if (!empty(apiKey)) {
        // TODO LOG INTEGRATOR ACTIONS
        return resolve(result)
      }

      const managerId = await session.getManagerId(req)
      if (empty(managerId)) result.statusCode = 401

      if (result.statusCode == 0) {
        const hasManagerRole = await session.hasManagerRole(roles, managerId)
        if (!hasManagerRole) result.statusCode = 403
      }
      if (!empty(actionType)) {
        const actionTable = req.route.path.substring(1)
        db.models.ManagerLog.create({ managerId, type: actionType, route: actionTable, data: JSON.stringify(actionData) })
      }
      resolve(result)
    })
  }
  return application;
};