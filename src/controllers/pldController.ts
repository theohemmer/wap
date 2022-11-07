import IController from "./controller";
import express, {NextFunction, Request, Response, text} from "express";
import { authUser } from "../middlewares/auth";
import Card from "../models/card";
import makePld from "../../pldGenerator";
import { Op } from "sequelize";
import User from "../models/user";
import Part from "../models/part";
import { checkPerm } from "../middlewares/checkPerms";
import multer, { MulterError } from "multer";
import { renameSync, rmSync } from "fs";

class PLDController implements IController {
    public path = "/pld";
    public router = express.Router();
    private importedGenerator : {
        generatePld: Function,
        requireImages: string[]
    } = null;

    private upload = multer({
        dest: "tmp_uploads/",
        fileFilter(req, file, callback) {
            if (file.mimetype == "image/jpeg" && (req.baseUrl + req.path == '/pld/setImages'))
                return callback(null, true);
            if (file.mimetype == "image/png" && (req.baseUrl + req.path == '/pld/setImages'))
                return callback(null, true);
            if ((file.mimetype == "text/javascript" || file.mimetype == "application/x-javascript") && (req.baseUrl + req.path == '/pld/setGenerator'))
                return callback(null, true);
            callback(new Error("Invalid file: " + file.mimetype));
        },
        limits: {
            fileSize: 10 * 1000 * 1000 // 10 MB
        }
    })

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get("/", authUser, checkPerm("EDITOR"), this.pld);
        this.router.get("/setGenerator", authUser, checkPerm("EDITOR"), this.setGeneratorGET);
        this.router.post("/setGenerator", authUser, checkPerm("EDITOR"), this.setGeneratorPOST);
        this.router.get("/setImages", authUser, checkPerm("EDITOR"), this.importGenerator, this.setImagesGET);
        this.router.post("/setImages", authUser, checkPerm("EDITOR"), this.importGenerator, this.setImagesPOST);
    }

    private async importGenerator(req: Request, res: Response, next: NextFunction): Promise<any> {
        const imported = await import("../../pldGenerator/custom");
        if (!imported.generatePLD || !imported.getRequired)
            return res.redirect("/setGenerator/?error=invalid_or_missing_generator");
        this.importedGenerator = {
            generatePld: imported.getGenerator(),
            requireImages: imported.getRequired()
        }
        next();
    }

    private pld = async (req: Request, res: Response) => {
        return res.redirect("/pld/setGenerator");
    }

    private setGeneratorGET = async (req: Request, res: Response) => {
        return res.render("pld/set_generator", {
            currentPage: '/pld',
            wap: req.wap,
            user: req.user,
        })
    }

    private setGeneratorPOST = async (req: Request, res: Response) => {
        this.upload.single("generator.js")(req, res, async function (err) {
            if (err) {
                console.log(err);
                return res.redirect("/pld/setGenerator?error=invalid_file_type");
            }
            if (req.file) {
                renameSync(req.file.path, "pldGenerator/custom/customGenerator/customPldGenerator.js");
            }
            return res.redirect("/pld/setImages");
        })
    }

    private setImagesGET = async (req: Request, res: Response) => {
        return res.render("pld/set_images", {
            currentPage: '/pld',
            wap: req.wap,
            user: req.user,
            requiredImages: this.importedGenerator.requireImages,
        })
    }

    private setImagesPOST = async (req: Request, res: Response) => {
        const requireImages = this.importedGenerator.requireImages;
        const fields = requireImages.map(x => { return { name: x, maxCount: 1} });
        const filesMiddleware = this.upload.fields(fields);
        filesMiddleware(req, res, async function (err) {
            if (err) {
                console.log(err);
                return res.redirect("/pld/setImages?error=invalid_file_type");
            }
            for (const required of requireImages) {
                if (req.files[required]) {
                    renameSync(req.files[required].path, "pldGenerator/assets/" + req.files[required]);
                }
            }
            // TODO: redirect to a summary page before generating preview
            return res.redirect("/setImages?info=succes");
        })
    }

    private pldGen = async (req: Request, res: Response) => {
        const allCards = await Card.findAll({
            where: {
                idInSprint: {
                    [Op.ne]: -1
                },
                sprintId: req.wap.sprint.id
            },
            order: [['sprintId', 'ASC'], ['partId', 'ASC'], ['idInSprint', 'ASC']],
            include: [
                User,
                Part
            ]
        });
        let dd: any = null;
        //dd = generatePLD(allCards);
        makePld(dd, {}, "./pldGenerator/generated/test.pdf");
        return res.redirect("/dashboard/?info=success");
    }
}

export default PLDController;